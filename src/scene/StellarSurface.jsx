import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { temperatureColor } from './stellarPhysics';
import { SUN_RADIUS_PC } from './scale';
import { GRANULE_LIFETIME_S, MAX_ACTIVE_REGIONS, SUNSPOT, TIME_ACCELERATION, activeRegions, granulesPerRadius, limbDarkening, surfaceActivity } from './stellarSurfaceModel';
import PlasmaLoops from './PlasmaLoops';
import { playSolarChromosphere, solarChromosphereMap } from './solarChromosphereMap';
import simplex3d from './shaders/simplex3d.glsl?raw';
import { filtroPorId, useFiltroEstelar } from './filtroEstelar';
import { SDO_CHANNELS, playSdoVideo, sdoChannelDate, sdoImageFrame, sdoTexture } from './sdoSolar';
import { EPHEMERIS_DATE } from './solarEphemeris';

// Alcance del deslumbramiento que rodea al disco sin filtro. Representa la luz que desborda
// al mirar la estrella directamente, no una corona medida, y no amplía el radio físico.
const CORONA_RADII = 5;
// Un gránulo completa su ciclo en una vida media acelerada.
const BOIL_RATE = Math.PI / (GRANULE_LIFETIME_S / TIME_ACCELERATION);
const SPOT_GRID = 7;
// Giro máximo (rad/s) con que los rayos siguen a la cámara: un giro rápido no los acelera.
const CALM_TURN_RATE = 0.35;
const SOLAR_GRANULES = granulesPerRadius(5772, 1);

const surfaceVertex = `
  varying vec3 surfacePoint;
  varying vec3 eyeNormal;
  varying vec3 eyeDirection;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    surfacePoint = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    eyeNormal = normalize(normalMatrix * normal);
    eyeDirection = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;
const surfaceFragment = `
  uniform float time;
  uniform float granules;
  uniform float boil;
  uniform float convection;
  uniform float spots;
  uniform float limb;
  uniform float glare;
  uniform float halpha;
  uniform float euv;
  uniform float structure;
  uniform vec3 temperatureTint;
  uniform vec3 umbraTint;
  uniform vec4 regions[${MAX_ACTIVE_REGIONS}];
  uniform sampler2D chromosphereMap;
  uniform float chromosphereReal;
  uniform float chromosphereVideo;
  uniform float magnet;
  uniform float sdo;
  uniform sampler2D sdoMap;
  uniform vec3 sdoToward;
  uniform vec3 sdoUp;
  uniform vec3 sdoRight;
  uniform float sdoRadius;
  uniform float sdoFlat;
  uniform float sdoVideo;
  varying vec3 surfacePoint;
  varying vec3 eyeNormal;
  varying vec3 eyeDirection;
  #include <logdepthbuf_pars_fragment>
  ${simplex3d}
  // «Hash without Sine», Dave Hoskins, licencia MIT.
  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }
  // Falso color dorado de las imágenes monocromáticas (H-alfa, ultravioleta), matizado
  // con el tono de la estrella. Es una paleta de presentación, no un color real.
  vec3 ramp(float value) {
    float v = clamp(value, 0.0, 1.5);
    vec3 c = mix(vec3(0.2, 0.05, 0.0), vec3(0.93, 0.47, 0.05), smoothstep(0.08, 0.6, v));
    c = mix(c, vec3(1.0, 0.85, 0.42), smoothstep(0.55, 0.95, v));
    c = mix(c, vec3(1.0), smoothstep(0.95, 1.4, v));
    vec3 hue = temperatureTint / max(max(temperatureTint.r, temperatureTint.g), temperatureTint.b);
    return c * smoothstep(-0.05, 0.3, v) * mix(vec3(1.0), hue * hue, 0.5);
  }
  // Paleta rojo-anaranjada con que el SDO presenta su banda de 304 Å (cromosfera).
  vec3 rampRed(float value) {
    float v = clamp(value, 0.0, 1.5);
    vec3 c = mix(vec3(0.1, 0.0, 0.0), vec3(0.85, 0.13, 0.02), smoothstep(0.05, 0.55, v));
    c = mix(c, vec3(1.0, 0.52, 0.1), smoothstep(0.5, 0.9, v));
    return mix(c, vec3(1.0, 0.93, 0.7), smoothstep(0.9, 1.35, v));
  }
  vec3 turn(vec3 p, float angle) {
    float c = cos(angle), s = sin(angle);
    return vec3(c * p.x + s * p.z, p.y, c * p.z - s * p.x);
  }
  // Distancias a los dos centros de celda más próximos; los centros se desplazan
  // con el tiempo para que los gránulos nazcan, se deformen y desaparezcan.
  vec2 cellDistances(vec3 x, float phase) {
    vec3 base = floor(x), f = x - base;
    float nearest = 8.0, second = 8.0;
    for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec3 cell = vec3(float(i), float(j), float(k));
      vec3 h = hash33(base + cell);
      vec3 d = cell + 0.5 + 0.42 * sin(phase * (0.6 + 0.8 * h.yzx) + 6.2831853 * h) - f;
      float distance2 = dot(d, d);
      if (distance2 < nearest) { second = nearest; nearest = distance2; }
      else if (distance2 < second) second = distance2;
    }
    return sqrt(vec2(nearest, second));
  }
  void main() {
    // Patrones sobre la esfera unitaria: sin costuras ni polos, igual a cualquier radio.
    vec3 p = normalize(surfacePoint);
    float footprint = length(fwidth(p));
    // La rotación real (≈ 25 días) es imperceptible incluso acelerada: no se anima.
    vec3 rotating = p;

    // Manchas en las regiones activas de la estrella (compartidas con los arcos de plasma).
    vec3 y = p * ${SPOT_GRID.toFixed(1)};
    float best = 8.0, umbraRadius = 0.0; vec3 centre = vec3(0.0, 1.0, 0.0);
    for (int i = 0; i < ${MAX_ACTIVE_REGIONS}; i++) {
      float separation = distance(p, regions[i].xyz);
      if (regions[i].w > 0.0 && separation < best) { best = separation; centre = regions[i].xyz; umbraRadius = regions[i].w; }
    }
    float present = step(best, 4.0);
    vec3 delta = centre - p, id = hash33(centre * 17.0 + 3.0);
    float penumbraRadius = umbraRadius * ${SUNSPOT.penumbraRadiusRatio.toFixed(3)};
    float r = length(delta) * (1.0 + 0.2 * snoise(y * 3.0 + id * 10.0));
    float edge = max(footprint, 0.0006);
    float umbra = present * (1.0 - smoothstep(umbraRadius - edge, umbraRadius + edge, r));
    float penumbra = present * (1.0 - smoothstep(penumbraRadius - edge, penumbraRadius + edge, r));
    // Filamentos radiales de la penumbra alrededor del centro de la mancha.
    vec3 east = normalize(cross(p, vec3(0.0, 1.0, 0.0)));
    float angle = atan(dot(delta, cross(p, east)), dot(delta, east));
    float filaments = snoise(vec3(cos(angle), sin(angle), id.z * 9.0) * 7.0 + vec3(0.0, 0.0, r / penumbraRadius));
    float spotIntensity = mix(1.0, ${SUNSPOT.penumbraIntensity.toFixed(2)} + 0.1 * filaments, penumbra);
    spotIntensity = mix(spotIntensity, ${SUNSPOT.umbraIntensity.toFixed(2)} + 0.06 * snoise(y * 14.0), umbra);

    // Granulación: celdas brillantes poligonales separadas por carriles oscuros estrechos.
    // Se desvanece cuando un gránulo ocupa menos de unos píxeles, como en una imagen real.
    float resolved = (1.0 - smoothstep(0.3, 0.8, footprint * granules)) * convection * (1.0 - penumbra);
    float granulation = 1.0, lane = 1.0;
    if (resolved > 0.002) {
      vec3 x = rotating * granules;
      x += 0.3 * vec3(snoise(x * 0.5), snoise(x * 0.5 + 17.3), snoise(x * 0.5 + 41.7));
      vec2 nearest = cellDistances(x, time * boil);
      float border = nearest.y - nearest.x;
      lane = smoothstep(0.0, 0.13, border);
      // Gránulo algo más brillante hacia su centro, con variación entre gránulos.
      float cell = (0.93 + 0.16 * smoothstep(0.0, 0.55, border)) * (1.0 + 0.07 * snoise(x * 0.8 + 5.0));
      granulation = mix(1.0, mix(0.58, cell, lane) / 0.97, resolved);
    }

    float mu = max(0.0, dot(normalize(eyeNormal), normalize(eyeDirection)));
    float intensity = granulation * spotIntensity * (1.0 - limb * (1.0 - mu));
    // Los carriles, las manchas y el borde son más fríos: cambian de color además de oscurecerse.
    float cooling = clamp(umbra + 0.3 * penumbra + 0.25 * resolved * (1.0 - lane), 0.0, 1.0);
    vec3 colour = mix(temperatureTint, umbraTint, cooling);
    colour *= mix(vec3(1.0), vec3(1.0, 0.86, 0.72), 0.6 * limb * (1.0 - mu));
    // Luz blanca con contraste realzado, como se presentan las imágenes de alta resolución:
    // lo oscuro se satura hacia el color propio de la estrella. Es un realce de presentación.
    float shade = clamp(intensity * 0.9, 0.0, 1.0);
    vec3 white = pow(colour, vec3(mix(9.0, 1.2, smoothstep(0.35, 0.95, shade)))) * shade;

    // Regiones activas en torno a las manchas, comunes a las vistas H-alfa y ultravioleta.
    vec3 q = rotating * structure;
    vec3 swirl = vec3(snoise(q * 7.0), snoise(q * 7.0 + 11.0), snoise(q * 7.0 + 23.0));
    float activity = convection * present * (1.0 - smoothstep(penumbraRadius, penumbraRadius * 5.0, r));

    // H-alfa: cromosfera. Fibrillas a la escala de la red supergranular (≈ 30 Mm),
    // playas brillantes junto a las manchas y filamentos oscuros alargados.
    float fibrils = snoise(q * 34.0 + 1.9 * swirl) * 0.6
      + snoise(q * 85.0 + 3.2 * swirl + vec3(0.0, time * 0.02, 0.0)) * 0.4 * (1.0 - smoothstep(0.3, 0.9, footprint * structure * 85.0));
    float plage = activity * smoothstep(-0.35, 0.35, snoise(q * 19.0 + 2.0 * swirl));
    float chromosphere = 0.45 + convection * (0.36 * fibrils + 0.6 * plage * (0.6 + 0.4 * fibrils));
    chromosphere *= (1.0 - 0.75 * umbra) * (1.0 - 0.3 * (1.0 - mu));
    vec3 alpha = rampRed(chromosphere);
    // Donde está disponible se muestra el mapa real del Sol (NASA, 304 Å) en lugar del
    // dibujo; en otras estrellas es un sustituto solar, atenuado si no hay convección.
    vec2 mapUv = vec2(atan(p.z, p.x) / 6.2831853 + 0.5, asin(clamp(p.y, -1.0, 1.0)) / 3.14159265 + 0.5);
    vec3 observed = texture2D(chromosphereMap, mapUv).rgb;
    // Un vídeo llega en sRGB sin decodificar; la imagen fija ya llega en lineal.
    observed = mix(observed, pow(observed, vec3(2.2)), chromosphereVideo) * (1.0 - 0.3 * pow(1.0 - mu, 2.0));
    alpha = mix(alpha, observed, chromosphereReal * smoothstep(0.1, 0.6, convection));

    // Ultravioleta extremo (como SDO/AIA a 171–193 Å): corona. Disco oscuro de grano fino con
    // puntos brillantes, regiones activas muy brillantes de las que salen abanicos de plasma
    // siguiendo el campo magnético, agujeros coronales oscuros y borde más brillante.
    // Composición de tres bandas (211, 193 y 171 Å en rojo, verde y azul), como las imágenes
    // combinadas del SDO: el color indica temperatura. Dorado y blanco = plasma más caliente
    // de las regiones activas; azul = plasma más templado en el extremo de los abanicos.
    float grain = 0.5 + 0.5 * snoise(q * 70.0 + swirl) * (1.0 - smoothstep(0.3, 0.9, footprint * structure * 70.0));
    float points = pow(max(0.0, snoise(q * 42.0 + 3.0)), 8.0);
    float reach = 0.12 + penumbraRadius * 9.0;
    float bend = angle + 1.5 * sin(id.x * 6.2832) * r / max(reach, 0.0001);
    vec3 around = vec3(cos(bend), sin(bend), id.z * 5.0);
    float fan = pow(0.5 + 0.5 * snoise(around * 7.0 + vec3(0.0, 0.0, r * 5.0 - time * 0.01)), 2.5)
      * (0.55 + 0.45 * snoise(around * 19.0 + vec3(0.0, 0.0, r * 3.0)));
    float core = 1.0 - smoothstep(penumbraRadius * 0.4, penumbraRadius * 3.0, r);
    float spread = 1.0 - smoothstep(penumbraRadius * 1.5, reach, r);
    float hole = smoothstep(0.2, 0.5, snoise(q * 1.3 + 77.0)) * smoothstep(0.15, 0.6, abs(p.y));
    // Corona en calma: mosaico verde azulado y oliva, más oscuro que las regiones activas.
    float patches = 0.5 + 0.5 * snoise(q * 3.5 + 0.6 * swirl + 19.0);
    vec3 calm = mix(vec3(0.04, 0.12, 0.15), vec3(0.24, 0.24, 0.1), patches);
    vec3 quiet = mix(calm * (0.55 + 0.75 * grain), vec3(0.01, 0.02, 0.14), 0.94 * hole);
    vec3 strands = mix(vec3(0.3, 0.48, 1.0), vec3(1.0, 0.72, 0.22), smoothstep(0.0, 0.65, spread)) * spread * max(fan, 0.0) * 1.5;
    vec3 ultraviolet = quiet * (1.0 - 0.55 * convection * present * spread)
      + convection * (points * (1.0 - hole) * vec3(0.9, 0.85, 0.6) + present * (strands + 1.25 * core * vec3(1.0, 0.95, 0.8)))
      + 0.55 * pow(1.0 - mu, 3.0) * vec3(0.85, 0.75, 0.25);

    // Magnetograma (como SDO/HMI): gris donde el campo es débil; cada región activa es un par
    // de polaridades, blanca (hacia fuera) y negra (hacia dentro), a uno y otro lado de la mancha.
    float side = clamp(dot(-delta, east) / max(penumbraRadius * 2.0, 0.0001), -1.0, 1.0);
    float strength = clamp(1.5 * activity + penumbra, 0.0, 1.0) * (id.y > 0.5 ? 1.0 : -1.0);
    // Gris medio de la imagen (0,5 en sRGB), pasado a luz lineal como el resto del sombreador.
    vec3 magnetic = vec3(pow(clamp(0.5 + 0.45 * side * strength + 0.03 * convection * snoise(q * 60.0), 0.0, 1.0), 2.2));
    vec3 filtered = mix(mix(mix(white, alpha, halpha), ultraviolet, euv), magnetic, magnet);
    // Imagen real del SDO sobre la cara que miraba a la Tierra. La cara oculta recibe su reflejo
    // en espejo: un punto y su simétrico respecto del borde del disco toman el mismo píxel, así
    // que no hay costura. Se lee un 1,5 % por dentro del borde para no tomar la corona exterior.
    vec2 sdoUv = 0.5 + 0.5 * 0.985 * sdoRadius * vec2(dot(p, sdoRight), dot(p, sdoUp));
    // Junto al borde del disco los píxeles se estiran sobre la esfera: allí se lee la imagen
    // desenfocada (mipmaps) para que no se vean franjas.
    float facing = dot(p, sdoToward);
    vec3 observedSdo = texture2D(sdoMap, sdoUv, 4.0 * (1.0 - smoothstep(0.0, 0.25, abs(facing)))).rgb;
    // Un vídeo llega en sRGB sin decodificar; la imagen fija ya llega en lineal.
    observedSdo = mix(observedSdo, pow(observedSdo, vec3(2.2)), sdoVideo);
    // Imagen aplanada (HMI): se repone el oscurecimiento del borde según la cámara, medido en
    // la imagen sin aplanar (brillo ≈ 0,53 × cos θ en sRGB; 0,813 es el centro de la aplanada).
    float flatLevel = dot(pow(observedSdo, vec3(1.0 / 2.2)), vec3(0.299, 0.587, 0.114)) / 0.813;
    observedSdo = mix(observedSdo, vec3(pow(clamp(0.529 * flatLevel * mu, 0.0, 1.0), 2.2)), sdoFlat);
    filtered = mix(filtered, observedSdo, sdo);

    // Sin filtro: disco sobreexpuesto, sin detalle, como al mirar la estrella directamente.
    vec3 overexposed = mix(temperatureTint, vec3(1.0), 0.55);
    vec3 result = mix(filtered, overexposed, glare);
    gl_FragColor = vec4(result, 1.0);
    #include <logdepthbuf_fragment>
    #include <colorspace_fragment>
  }
`;

const coronaVertex = `
  varying vec3 shellPoint;
  varying vec3 cameraPoint;
  varying vec3 viewPoint;
  varying vec3 viewCentre;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    shellPoint = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    viewPoint = mv.xyz;
    viewCentre = modelViewMatrix[3].xyz;
    // Cámara en coordenadas del objeto (escala uniforme), sin invertir matrices diminutas.
    mat3 linear = mat3(modelViewMatrix);
    cameraPoint = -(transpose(linear) * modelViewMatrix[3].xyz) / dot(linear[0], linear[0]);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;
const coronaFragment = `
  uniform float time;
  uniform float convection;
  uniform float extent;
  uniform float glare;
  uniform float halpha;
  uniform float euv;
  uniform vec3 temperatureTint;
  uniform vec3 calmRight;
  uniform vec3 calmUp;
  uniform vec3 sdoTint;
  uniform float sdoTintMix;
  varying vec3 shellPoint;
  varying vec3 cameraPoint;
  varying vec3 viewPoint;
  varying vec3 viewCentre;
  #include <logdepthbuf_pars_fragment>
  ${simplex3d}
  void main() {
    // Punto del rayo más cercano al centro; su distancia se mide en radios estelares.
    vec3 ray = normalize(shellPoint - cameraPoint);
    vec3 nearest = shellPoint - ray * dot(shellPoint, ray);
    // Sin descartar el borde: el disco opaco tapa por profundidad lo que queda detrás.
    float height = max(0.0, length(nearest) - 1.0);
    float reach = height / (extent - 1.0);
    vec3 direction = normalize(nearest);
    float streamers = 0.5 + 0.5 * snoise(direction * 2.6 + vec3(0.0, time * 0.02, 0.0));
    float fine = 0.5 + 0.5 * snoise(direction * 9.0 + vec3(time * 0.035, 0.0, reach * 2.0));
    float rim = exp(-height * 22.0);
    float glow = pow(max(0.0, 1.0 - reach), 3.0) * (0.35 + convection * (0.5 * streamers + 0.25 * fine));
    // Sin filtro, el deslumbramiento rodea el disco; con filtro casi desaparece.
    float halo = exp(-height * 2.2) + 0.5 * pow(max(0.0, 1.0 - reach), 2.0);
    // Sin filtro: rayos finos y cortos. El trazo fino sigue el ángulo en la imagen, para que no
    // parpadee al mover la cámara; su brillo y su largo dependen de direcciones fijas de la
    // estrella con poco detalle, así que al rodearla cambian, pero de forma gradual.
    vec2 offset = viewPoint.xy / -viewPoint.z - viewCentre.xy / -viewCentre.z;
    float around = atan(offset.y, offset.x);
    // Dirección de la estrella bajo cada ángulo de la imagen, con una orientación de cámara
    // suavizada: aunque la cámara gire deprisa, los rayos cambian siempre con calma.
    vec3 anchored = normalize(calmRight * cos(around) + calmUp * sin(around));
    float phase = 6.2832 * (0.5 + 0.5 * snoise(anchored * 2.0 + 11.0));
    // Vaivén lateral: cada rayo se inclina más hacia su punta, con un periodo de unos 9 s.
    float wave = around + height * (0.06 * sin(time * 0.66 + phase) + 0.03 * sin(time * 0.41 + 2.0 * phase));
    vec2 ring = vec2(cos(wave), sin(wave));
    float strands = pow(0.5 + 0.5 * snoise(vec3(ring * 14.0, 0.0)), 5.0)
      + 0.7 * pow(0.5 + 0.5 * snoise(vec3(ring * 32.0 + 7.0, 0.0)), 6.0);
    float rays = strands * (0.3 + 0.7 * smoothstep(-0.4, 0.6, snoise(anchored * 2.5 + 5.0)));
    // Cada rayo crece y se encoge despacio (entre ≈ 0,12 y 0,45 radios).
    float reachRay = 0.12 + 0.33 * (0.5 + 0.5 * snoise(anchored * 3.0 + vec3(0.0, 0.0, time * 0.133)));
    float dazzle = min(1.0, rim + 0.8 * halo + 0.9 * rays * (1.0 - smoothstep(reachRay * 0.35, reachRay, height)));
    // Franja de espículas de la cromosfera (5–10 Mm) y corona en ultravioleta, con escala
    // de altura ≈ 0,1 radios a 1,5 millones de kelvin. Las protuberancias son geometría aparte.
    float chromosphere = convection * 0.5 * exp(-height / 0.009);
    float coronal = max(convection, 0.1) * 0.75 * exp(-height / 0.16);
    float filtered = mix(mix(0.08 * rim + 0.07 * glow, chromosphere, halpha), coronal, euv);
    float alpha = mix(filtered, dazzle, glare);
    // Cromosfera en rojo (304 Å); corona del amarillo al verde y al azul al alejarse del disco.
    vec3 far = mix(mix(vec3(1.0, 0.85, 0.3), vec3(0.35, 0.75, 0.35), smoothstep(0.0, 0.18, height)), vec3(0.2, 0.3, 0.9), smoothstep(0.15, 0.6, height));
    vec3 filteredColour = mix(vec3(1.0, 0.35, 0.08), far, euv / max(halpha + euv, 0.001));
    // Con una imagen del SDO, el resplandor toma el color de su corona en vez del simulado.
    filteredColour = mix(filteredColour, sdoTint, sdoTintMix);
    vec3 colour = mix(mix(temperatureTint, vec3(1.0), 0.35), filteredColour, max(halpha, euv) * (1.0 - glare));
    gl_FragColor = vec4(colour * alpha, alpha);
    #include <logdepthbuf_fragment>
    #include <colorspace_fragment>
  }
`;

// Un único modelo animado: se escala por radio y se tiñe por temperatura.
// Malla unitaria trasladada con doble precisión en CPU; radio nunca ampliado por píxeles.
// `solar`: es el Sol, el único con imágenes reales del SDO.
export default function StellarSurface({ position, radiusPc, temperatureK, solar = false }) {
  const uniforms = useMemo(() => {
    const tint = temperature => {
      const [r, g, b] = temperatureColor(temperature);
      return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    };
    const { convection, spots } = surfaceActivity(temperatureK);
    const granules = granulesPerRadius(temperatureK, radiusPc / SUN_RADIUS_PC);
    const active = activeRegions(temperatureK, radiusPc / SUN_RADIUS_PC);
    const regions = Array.from({ length: MAX_ACTIVE_REGIONS }, (_, i) => active[i]
      ? new THREE.Vector4(...active[i].direction, active[i].umbraRadius) : new THREE.Vector4(0, 1, 0, 0));
    // Las estructuras magnéticas se escalan como los gránulos; aproximación sin dato por estrella.
    const structure = Math.max(0.08, Math.min(3, granules / SOLAR_GRANULES));
    const shared = { time: { value: 0 }, glare: { value: 1 }, halpha: { value: 0 }, euv: { value: 0 }, structure: { value: structure },
      convection: { value: convection }, temperatureTint: { value: tint(temperatureK) } };
    return {
      surface: { ...shared, spots: { value: spots }, limb: { value: limbDarkening(temperatureK) },
        granules: { value: granules }, regions: { value: regions },
        chromosphereMap: { value: null }, chromosphereReal: { value: 0 }, chromosphereVideo: { value: 0 },
        magnet: { value: 0 }, sdo: { value: 0 }, sdoMap: { value: null }, sdoRadius: { value: 0.8 }, sdoFlat: { value: 0 }, sdoVideo: { value: 0 },
        sdoToward: { value: new THREE.Vector3(0, 0, 1) }, sdoUp: { value: new THREE.Vector3(0, 1, 0) }, sdoRight: { value: new THREE.Vector3(1, 0, 0) },
        // Los gránulos grandes evolucionan más despacio; aproximación, no medida por estrella.
        boil: { value: BOIL_RATE * Math.max(0.15, Math.min(2, Math.sqrt(granules / SOLAR_GRANULES))) },
        umbraTint: { value: tint(temperatureK - SUNSPOT.umbraCoolingK) } },
      corona: { ...shared, extent: { value: CORONA_RADII }, sdoTint: { value: new THREE.Color() }, sdoTintMix: { value: 0 },
        calmRight: { value: new THREE.Vector3(1, 0, 0) }, calmUp: { value: new THREE.Vector3(0, 1, 0) } },
      active,
    };
  }, [temperatureK, radiusPc]);
  const surface = useRef();
  const corona = useRef();
  const group = useRef();
  // Orientación de la cámara respecto de la estrella, seguida a velocidad limitada.
  const calm = useRef(null);
  // Estado del filtro que también leen los arcos de plasma en cada fotograma.
  const view = useRef({ time: 0, glare: 1, halpha: 0, euv: 0, real: 0 });
  // Canal y fecha de la imagen del SDO cuyos ejes ya se pasaron al sombreador.
  const sdoFrame = useRef('');
  const filtro = useFiltroEstelar();
  useFrame(({ clock, camera }, delta) => {
    if (!surface.current || !corona.current) return;
    const shared = surface.current.uniforms, halo = corona.current.uniforms;
    // Mapa real de la cromosfera: el vídeo en cuanto se reproduce; antes, la imagen fija.
    const maps = solarChromosphereMap();
    const map = maps.videoReady ? maps.video : maps.stillReady ? maps.still : null;
    shared.chromosphereMap.value = map ?? maps.still;
    shared.chromosphereReal.value = map ? 1 : 0;
    shared.chromosphereVideo.value = maps.videoReady ? 1 : 0;
    const { capa, canal } = filtroPorId(filtro);
    playSolarChromosphere(capa === 'cromosfera');
    view.current.real = map ? 1 : 0;
    view.current.time = shared.time.value = halo.time.value = clock.elapsedTime % 3600;
    // Transición breve entre la vista deslumbrada y la filtrada.
    const step = Math.min(1, delta * 4);
    [['glare', filtro === 'ninguno'], ['halpha', capa === 'cromosfera'], ['euv', capa === 'corona']].forEach(([name, on]) => {
      shared[name].value += ((on ? 1 : 0) - shared[name].value) * step;
      view.current[name] = halo[name].value = shared[name].value;
    });
    shared.magnet.value += ((capa === 'magnetica' ? 1 : 0) - shared.magnet.value) * step;
    // Imagen del SDO del canal elegido, solo en el Sol y cuando ya cargó.
    const image = solar && canal ? sdoTexture(canal) : null;
    const fecha = image && sdoChannelDate(canal);
    if (solar) playSdoVideo(canal, Boolean(image));
    if (image) {
      const { flat, tint } = SDO_CHANNELS[canal];
      shared.sdoMap.value = image.texture;
      shared.sdoFlat.value = flat ? 1 : 0;
      shared.sdoVideo.value = image.playing ? 1 : 0;
      if (tint) halo.sdoTint.value.setRGB(...tint, THREE.SRGBColorSpace);
      halo.sdoTintMix.value = tint && image.ready ? shared.sdo.value : 0;
    } else halo.sdoTintMix.value = 0;
    shared.sdo.value += ((image?.ready ? 1 : 0) - shared.sdo.value) * step;
    if (image && group.current && sdoFrame.current !== `${canal}${fecha}`) {
      sdoFrame.current = `${canal}${fecha}`;
      const frame = sdoImageFrame(fecha ? new Date(fecha) : EPHEMERIS_DATE, canal);
      const toLocal = group.current.getWorldQuaternion(new THREE.Quaternion()).invert();
      shared.sdoToward.value.copy(frame.toward).applyQuaternion(toLocal);
      shared.sdoUp.value.copy(frame.up).applyQuaternion(toLocal);
      shared.sdoRight.value.copy(frame.right).applyQuaternion(toLocal);
      shared.sdoRadius.value = frame.diskRadius;
    }
    // Sobre la imagen real no se dibujan arcos de plasma inventados.
    view.current.halpha *= 1 - shared.sdo.value;
    view.current.euv *= 1 - shared.sdo.value;
    if (group.current) {
      const local = group.current.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(camera.quaternion);
      if (!calm.current) calm.current = local.clone();
      else calm.current.rotateTowards(local, CALM_TURN_RATE * delta);
      halo.calmRight.value.set(1, 0, 0).applyQuaternion(calm.current);
      halo.calmUp.value.set(0, 1, 0).applyQuaternion(calm.current);
    }
  });
  return <group ref={group} position={position} scale={radiusPc} rotation={[Math.PI / 2, 0, 0]}>
    <mesh>
      <sphereGeometry args={[1, 128, 96]} />
      <shaderMaterial ref={surface} uniforms={uniforms.surface} vertexShader={surfaceVertex} fragmentShader={surfaceFragment} toneMapped={false} />
    </mesh>
    <PlasmaLoops regions={uniforms.active} tint={uniforms.surface.temperatureTint.value} view={view} />
    <mesh raycast={() => null}>
      <sphereGeometry args={[CORONA_RADII, 48, 32]} />
      <shaderMaterial ref={corona} uniforms={uniforms.corona} vertexShader={coronaVertex} fragmentShader={coronaFragment}
        side={THREE.BackSide} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  </group>;
}
