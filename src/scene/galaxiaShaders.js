// src/scene/galaxiaShaders.js (rama f7-prototipos): sombreadores del volumen de la galaxia.
// Las constantes salen de galaxiaModelo.js para que el GLSL y la gemela en JS (integrarRayo, tono) no se separen.
import { ANCHO_PLANTA_KPC, CERCA, EXT_RGB, GRUMOS, LOSA, PASO, PASOS_TOPE_GLSL, PERFIL, POLVO_B, SOL_KPC, TAU_CODIGO, TONO } from './galaxiaModelo.js';

// Literal float de GLSL (siempre con punto o exponente).
const f = v => { const s = Number(v).toPrecision(9); return /[.e]/.test(s) ? s : `${s}.0`; };
const v3 = a => `vec3(${a.map(f).join(', ')})`;
const B = PERFIL.bulbo, A = PERFIL.alabeo;

// Marcha: un triángulo que cubre el sub-rectángulo s·W × s·H del render target (vNdc ∈ [−1, 1]²).
export const marchaVertex = /* glsl */`
  varying vec2 vNdc;
  void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const marchaFragment = /* glsl */`
  precision highp float;
  precision highp sampler3D;
  uniform vec3 uCam;          // cámara, kpc galactocéntricos
  uniform mat3 uRayos;        // columnas: derecha, arriba, atrás (marco galáctico)
  uniform vec2 uTan;          // tan(fov/2)·aspecto, tan(fov/2)
  uniform float uPixAng;      // radianes por píxel del render target (2·tan(fov/2)/alto)
  uniform sampler2D uEmision; // RGB, sRGB decodificado por el hardware (lineal al leer)
  uniform sampler2D uPolvo;   // R: τ_V codificado; G: corrección de columna (A, C) o altura del polvo (B); B: f_joven/0,8
  uniform sampler3D uRuido;   // 64³, gaussiana/6 + 0,5 (solo B)
  uniform float uTexelE;      // kpc por texel de la emisión
  uniform float uTexelP;      // kpc por texel del polvo
  uniform float uEscalaE;     // 1 en A y C; escalaE de modeloB.json en B
  uniform float uBarra;       // ángulo de la barra (rad)
  uniform float uModeloB;     // 1 en B
  uniform float uGrumos;      // 1 en B: grumos 3D del polvo
  uniform float uLuz;         // 1 en A y B; 0,9 en C (el 10 % va a las estrellas)
  uniform float uDh;          // kpc (regla del paso)
  uniform int uPasosMax;      // 48 computador, 32 teléfono (≤ ${PASOS_TOPE_GLSL})
  uniform float uJitter;      // 1: primer paso con ruido; 0: sin ruido (pruebas)
  uniform float uExpo;        // exposición (1)
  uniform float uNegro;       // N en unidades de uExpo·C (CPU: puntoNegro)
  uniform float uInterior;    // ι (CPU: interiorGalaxia)
  varying vec2 vNdc;

  const float ANCHO = ${f(ANCHO_PLANTA_KPC)};
  const vec3 SOL = ${v3(SOL_KPC)};
  const float RSOL = ${f(Math.abs(SOL_KPC[0]))};
  const vec3 EXT = ${v3(EXT_RGB)};
  const float ZMAX = ${f(LOSA.zMax)}, RMAX = ${f(LOSA.rMax)}, ZSALIDA = ${f(LOSA.zSalida)};
  const float CZ = ${f(PASO.cz)}, HMIN = ${f(PASO.hMin)}, CT = ${f(PASO.ct)}, TMIN = ${f(PASO.tMin)}, DTMIN = ${f(PASO.dtMin)}, DTMAX = ${f(PASO.dtMax)};
  const float HDEL = ${f(PERFIL.hDelgado)}, HBARRA = ${f(PERFIL.hDelgadoBarra)}, BR0 = ${f(PERFIL.barraR[0])}, BR1 = ${f(PERFIL.barraR[1])};
  const float HGRU = ${f(PERFIL.hGrueso)}, FSOL = ${f(PERFIL.fGruesoSol)}, EF = ${f(PERFIL.escalaFGrueso)}, FMAX = ${f(PERFIL.fGruesoMax)};
  const float HJOV = ${f(PERFIL.hJoven)}, HPOLVO = ${f(PERFIL.hPolvo)};
  const float AX = ${f(B.ax)}, AY = ${f(B.ay)}, AZ = ${f(B.az)}, XX = ${f(B.xX)}, ANCHOX = ${f(B.anchoX)}, AMPX = ${f(B.amplitudX)}, S50 = ${f(B.s50)};
  const float ESC = ${f(PERFIL.ensanche.escala)}, TOPE = ${f(PERFIL.ensanche.tope)};
  const float AW = ${f(A.a)}, R0W = ${f(A.r0)}, PW = ${f(A.potencia)}, FASEW = ${f(A.fase * Math.PI / 180)};
  const float BUR0 = ${f(PERFIL.burbuja[0])}, BUR1 = ${f(PERFIL.burbuja[1])};
  const float CE0 = ${f(CERCA.emision[0])}, CE1 = ${f(CERCA.emision[1])}, CD0 = ${f(CERCA.polvo[0])}, CD1 = ${f(CERCA.polvo[1])};
  const float T0 = ${f(TAU_CODIGO.t0)}, LNMAX = ${f(Math.log1p(TAU_CODIGO.max / TAU_CODIGO.t0))};
  const float HPMIN = ${f(POLVO_B.hMin)}, HPMAX = ${f(POLVO_B.hMax)};
  const float GSIG2 = ${f(Math.expm1(GRUMOS.sigma ** 2))}, GCELDA = ${f(GRUMOS.celda)}, GE1 = ${f(GRUMOS.escala1)}, GE2 = ${f(GRUMOS.escala2)};
  const float GDES = ${f(GRUMOS.desfase2)}, GP2 = ${f(GRUMOS.peso2)}, GNORMA = ${f(GRUMOS.norma)};
  const float HOMBRO = ${f(TONO.hombro)}, FFUERA = ${f(TONO.factorFuera)}, FDENTRO = ${f(TONO.factorDentro)};
  const int TOPE_PASOS = ${PASOS_TOPE_GLSL};
  const float PROY_MAX = 0.8, LOD_LISO = 4.0;

  float ss(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
  float primitiva(float z, float h) { return sign(z) * (1.0 - exp(-abs(z) / h)) * 0.5; }
  float integralTramo(float za, float zb, float dt, float h) {
    float dz = zb - za;
    if (abs(dz) < 1e-3 * h) return exp(-abs(0.5 * (za + zb)) / h) / (2.0 * h) * dt;
    return dt * (primitiva(zb, h) - primitiva(za, h)) / dz;
  }
  float alabeo(vec2 p) {
    float R = length(p);
    if (R <= R0W) return 0.0;
    return AW * pow(R - R0W, PW) * sin(atan(p.y, -p.x) - FASEW);
  }
  float ensanche(float R) { return min(TOPE, exp(max(0.0, R - RSOL) / ESC)); }
  float hDelgado(float R) { return HBARRA + (HDEL - HBARRA) * ss(BR0, BR1, R); }
  float fGrueso(float R) { return min(FMAX, FSOL * exp(-(R - RSOL) / EF)); }
  vec2 ejesBarra(vec2 p) { float c = cos(uBarra), s = sin(uBarra); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }
  float pesoBulbo(vec2 pb) { float s = length(pb / vec2(AX, AY)) / S50; return min(1.0, exp(-s * s * s * 0.693147181)); }
  float hBulbo(vec2 pb) { float q = (abs(pb.x) - XX) / ANCHOX; return AZ * (1.0 + AMPX * exp(-q * q)); }
  vec2 uvMapa(vec2 p) { return vec2(0.5 - p.y / ANCHO, 0.5 + p.x / ANCHO); }
  float decodTau(float r) { return T0 * (exp(r * LNMAX) - 1.0); }
  float ign(vec2 c) { return fract(52.9829189 * fract(dot(c, vec2(0.06711056, 0.00583715)))); }
  // Tramo dentro de la losa |z| ≤ ZMAX y el cilindro R ≤ RMAX; x > y si no hay tramo.
  vec2 losa(vec3 o, vec3 d) {
    float t0 = 0.0, t1 = 1e9;
    if (abs(d.z) < 1e-9) { if (abs(o.z) > ZMAX) return vec2(1.0, 0.0); }
    else { float a = (-ZMAX - o.z) / d.z, b = (ZMAX - o.z) / d.z; t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b)); }
    float A = dot(d.xy, d.xy), Bq = 2.0 * dot(o.xy, d.xy), Cq = dot(o.xy, o.xy) - RMAX * RMAX;
    if (A < 1e-12) { if (Cq > 0.0) return vec2(1.0, 0.0); }
    else {
      float D = Bq * Bq - 4.0 * A * Cq;
      if (D < 0.0) return vec2(1.0, 0.0);
      float r = sqrt(D);
      t0 = max(t0, (-Bq - r) / (2.0 * A)); t1 = min(t1, (-Bq + r) / (2.0 * A));
    }
    return vec2(t0, t1);
  }
  float largoPaso(vec3 p, vec3 d, float t) {
    float z = p.z - alabeo(p.xy);
    float dt = min(min(CZ * max(abs(z), HMIN) / max(abs(d.z), 1e-3), CT * max(t, TMIN)), uDh / max(length(d.xy), 1e-3));
    return clamp(dt, DTMIN, DTMAX);
  }
  float hombro(float x) { return x < HOMBRO ? x : HOMBRO + (1.0 - HOMBRO) * (1.0 - exp(-(x - HOMBRO) / (1.0 - HOMBRO))); }
  vec3 oetf(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }

  void main() {
    vec3 d = normalize(uRayos * vec3(vNdc * uTan, -1.0));
    vec3 o = uCam;
    vec2 iv = losa(o, d);
    vec3 C = vec3(0.0), T = vec3(1.0);
    if (iv.y > iv.x) {
      float t = max(iv.x, TMIN);
      float azar = ign(gl_FragCoord.xy);
      bool primero = true;
      for (int i = 0; i < TOPE_PASOS; i++) {
        if (i >= uPasosMax || t >= iv.y) break;
        vec3 pa = o + d * t;
        float dt = largoPaso(pa, d, t);
        if (primero) { dt *= 0.5 + mix(0.5, azar, uJitter); primero = false; }
        float tb = min(t + dt, iv.y); dt = tb - t;
        float tm = 0.5 * (t + tb);
        vec3 pm = o + d * tm;
        float R = length(pm.xy);
        float zw = alabeo(pm.xy);
        float fl = ensanche(R);
        float za = pa.z - zw, zb = o.z + d.z * tb - zw;
        // A: la planta se lee donde el rayo cruza el plano medio (con tope PROY_MAX): sin eso, desde arriba los rayos oblicuos
        // leían la planta detallada a varias alturas y la imagen quedaba con rayas radiales.
        vec2 pp = pm.xy;
        if (uModeloB < 0.5 && abs(d.z) > 1e-3) {
          vec2 off = d.xy * ((pm.z - zw) / d.z);
          float lo = length(off);
          if (lo > PROY_MAX) off *= PROY_MAX / lo;
          pp -= off;
        }
        vec2 uv = uvMapa(pp);
        float pie = max(tm * uPixAng, 0.5 * dt * length(d.xy));
        float lodE = log2(max(pie / uTexelE, 1.0));
        vec3 E = textureLod(uEmision, uv, lodE).rgb * uEscalaE;
        // El disco grueso y el bulbo son lisos: leen una planta muy suavizada (A; en B ya es lisa).
        vec3 El = uModeloB < 0.5 ? textureLod(uEmision, uv, lodE + LOD_LISO).rgb * uEscalaE : E;
        vec3 pol = textureLod(uPolvo, uv, log2(max(pie / uTexelP, 1.0))).rgb;
        float borde = 1.0 - ss(0.42, 0.50, length(uv - 0.5));
        if (uModeloB < 0.5) borde *= ss(0.045, 0.075, length((uv - vec2(0.5, 0.945)) * vec2(1.3, 1.0)));
        vec3 corr = uModeloB > 0.5 ? vec3(1.0) : min(pow(vec3(1.0 + 2.0 * pol.g), EXT), vec3(1.0 / 0.35));
        E *= corr * (borde * uLuz);
        El *= corr * (borde * uLuz);
        float tau = decodTau(pol.r);
        float fJ = 0.8 * pol.b;
        float hP = uModeloB > 0.5 ? mix(HPMIN, HPMAX, pol.g) : HPOLVO;
        vec2 pb = ejesBarra(pm.xy);
        float wb = pesoBulbo(pb);
        float fT = fGrueso(R);
        float fy = min(fJ, 1.0 - wb);
        float iDel = integralTramo(za, zb, dt, hDelgado(R) * fl);
        float iGru = integralTramo(za, zb, dt, HGRU * fl);
        float iJov = integralTramo(za, zb, dt, HJOV * fl);
        float iBul = integralTramo(za, zb, dt, hBulbo(pb));
        float iPol = integralTramo(za, zb, dt, hP * fl);
        float wE = ss(CE0, CE1, tm), wD = ss(CD0, CD1, tm);
        float perfil = (1.0 - fy - wb) * (1.0 - fT) * iDel + fy * iJov;
        float perfilLiso = (1.0 - fy - wb) * fT * iGru + wb * iBul;
        float tauV = tau * iPol * wD * ss(BUR0, BUR1, length(pm - SOL));
        if (uGrumos > 0.5) {
          float g1 = (texture(uRuido, pm / GE1).r - 0.5) * 6.0;
          float g2 = (texture(uRuido, pm / GE2 + GDES).r - 0.5) * 6.0;
          float gn = (g1 + GP2 * g2) / GNORMA;
          float s2 = log(1.0 + GSIG2 / max(1.0, dt / GCELDA));
          tauV *= exp(sqrt(s2) * gn - 0.5 * s2);
        }
        vec3 tc = tauV * EXT;
        vec3 fr = mix(1.0 - 0.5 * tc, (1.0 - exp(-tc)) / max(tc, vec3(1e-4)), step(vec3(1e-4), tc));
        C += T * (E * perfil + El * perfilLiso) * wE * fr;
        T *= exp(-tc);
        t = tb;
        if (max(T.r, max(T.g, T.b)) < 0.01) break;
        float zf = o.z + d.z * t - zw;
        if (abs(zf) > ZSALIDA && zf * d.z > 0.0) break;
      }
    }
    vec3 x = uExpo * C;
    float Y = dot(x, vec3(0.2126, 0.7152, 0.0722));
    x *= max(Y - uNegro, 0.0) / max(Y, 1e-9);
    x = vec3(hombro(x.r), hombro(x.g), hombro(x.b));
    vec3 c = mix(FFUERA, FDENTRO, uInterior) * oetf(x);
    c += (ign(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
    gl_FragColor = vec4(max(c, 0.0), 1.0);
  }
`;

// Composición: triángulo a pantalla completa en la lista opaca (renderOrder −1000), suma el sub-rectángulo escalado.
export const composicionVertex = /* glsl */`
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    gl_Position = vec4(position.xy * 400000.0, 0.0, 400000.0);
    #include <logdepthbuf_vertex>
  }
`;
export const composicionFragment = /* glsl */`
  uniform sampler2D uImagen;   // render target (tamaño del lienzo); la marcha escribió en [0, s·W] × [0, s·H]
  uniform vec2 uLienzo;        // W, H del drawing buffer
  uniform float uEscala;       // s
  uniform float uOpacidad;     // rampa · atenuación de modos
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 uv = gl_FragCoord.xy / uLienzo * uEscala;
    uv = clamp(uv, 0.5 / uLienzo, (uEscala * uLienzo - 0.5) / uLienzo);
    gl_FragColor = vec4(texture2D(uImagen, uv).rgb * uOpacidad, 0.0);
    #include <logdepthbuf_fragment>
  }
`;
