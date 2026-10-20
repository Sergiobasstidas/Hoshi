# Hoshi — documentación técnica

Cómo está construido Hoshi y cómo calcula lo que muestra. Los valores citados salen del código; cada apartado indica el archivo donde viven. Resumen general, ejecución y créditos en el [README](../README.md); avance por fechas en el [historial](HISTORIAL.md).

## 1. Finalidad

Hoshi es un explorador 3D del sistema solar, las estrellas cercanas y la Vía Láctea. Su objetivo es hacer comprensibles las distancias y escalas astronómicas recorriéndolas de forma continua, desde seis radios terrestres hasta 200.000 años luz, sin cambiar de escena.

Principio de diseño: **separar lo medido de lo ilustrativo.** Posiciones, distancias, radios y órbitas publicadas se dibujan a escala. Halos, marcadores, partículas de nubes y texturas son ayudas visuales y se declaran como tales en la interfaz.

## 2. Tecnologías

| Pieza | Uso |
| --- | --- |
| JavaScript / JSX, módulos ES | Todo el código; sin TypeScript |
| React 19 | Interfaz y estado |
| Three.js 0.184 | Render WebGL |
| React Three Fiber 9 y Drei 10 | Three.js como componentes de React; `OrbitControls`, `Html` |
| Vite 8 | Servidor de desarrollo y build estático |
| Node ≥ 22.12 | Build, pruebas (`node --test`) y generadores de datos |
| ESLint 10 | Análisis estático |
| Cloudflare Pages | Alojamiento del sitio estático |

No hay backend, base de datos ni llamadas a servicios astronómicos en tiempo de ejecución: todos los datos se procesan antes y se sirven como archivos estáticos.

## 3. Estructura

| Ruta | Contenido |
| --- | --- |
| `src/App.jsx` | Estado de la aplicación, navegación, fichas y montaje de la escena |
| `src/scene/` | Capas 3D, shaders y funciones puras de cálculo |
| `src/StarSearch.jsx`, `BarraDistancia.jsx`, `Dial*.jsx` | Buscador, escala lateral y visores |
| `data/raw/` | Catálogos originales sin modificar, con su procedencia |
| `data/processed/` | Datos que carga la aplicación |
| `public/` | Texturas, índice de búsqueda y licencias de terceros |
| `scripts/` | Generadores de datos y pruebas |

## 4. Unidades y sistema de coordenadas

Archivo: `src/scene/scale.js`.

- **Unidad de longitud:** el parsec (pc), en toda la escena.
- **Marco:** ecuatorial J2000, con origen en el Sol. El eje x apunta a ascensión recta 0 h, declinación 0°; el eje z, al polo norte celeste.
- **Constantes:** 1 UA = 1/206.265 pc; 1 UA = 149.597.870,7 km (IAU 2012); 1 año luz = 1/3,26156 pc; radio solar 695.700 km.

Posición de una estrella a partir de ascensión recta α, declinación δ y distancia d (`scripts/process_stars.js`):

```
x = d · cos δ · cos α
y = d · cos δ · sen α
z = d · sen δ
```

Se guardan siete cifras significativas: 0,02 UA de resolución a 1 pc y 2 UA a 100 pc. La distancia del catálogo tiene cuatro decimales de parsec (≈ 20 UA), que es la imprecisión radial.

**Regla:** las coordenadas del catálogo nunca se rotan ni se deforman para encuadrar. La presentación se resuelve moviendo la cámara.

### Eclíptica

El sistema solar se define en el plano de la eclíptica y se pasa al marco ecuatorial girando alrededor del eje x la oblicuidad ε = 23,43928°:

```
x_eq = x_ecl
y_eq = y_ecl · cos ε − z_ecl · sen ε
z_eq = y_ecl · sen ε + z_ecl · cos ε
```

La normal eclíptica (0, −sen ε, cos ε) es la vertical de cámara por defecto.

### Marco galáctico

Archivo: `src/scene/galaxy.js`. Los ejes galácticos IAU se expresan en el marco ecuatorial con la transpuesta de la rotación ICRS → galáctica:

```
X_gal (hacia el centro)   = (−0,0548755604, −0,8734370902, −0,4838350155)
Y_gal (sentido de giro)   = ( 0,4941094279, −0,4448296300,  0,7469822445)
Z_gal (polo norte)        = (−0,8676661490, −0,1980763734,  0,4559837762)
```

El centro galáctico se sitúa a 8.122 pc del Sol, con el Sol 20,8 pc sobre el plano. En la vista galáctica la vertical de cámara pasa de la normal eclíptica a Z_gal, de modo que el disco queda horizontal; al salir vuelve a la eclíptica. Es solo un cambio de cámara.

## 5. Precisión numérica

Un mismo espacio contiene superficies planetarias (10⁻¹⁰ pc) y la galaxia (10⁴ pc). Dos técnicas lo hacen posible:

**Origen flotante.** Al visitar una estrella, el origen de render pasa a esa estrella. La posición global de la cámara es siempre `camera.position + origin`. Las estrellas restan el origen en doble precisión en la CPU antes de convertirse a `Float32` para la GPU (`StarField.jsx`).

**Profundidad logarítmica reescalada.** Archivo: `depthPrecision.js`. El `log2(1 + w)` estándar de Three.js redondea a cero a distancias planetarias medidas en parsecs. Hoshi sustituye el fragmento de shader compartido por:

```
profundidad = log2(1 + w · 10¹²) / log2(1 + 400.000 · 10¹²)
```

Solo cambia la codificación de profundidad; posiciones, radios y proyección no se tocan. Plano cercano 10⁻¹⁴ pc, lejano 400.000 pc.

## 6. Sistema solar

Archivos: `scale.js`, `solarEphemeris.js`, `solarBodies.js`, `SolarSystem.jsx`, `OrbitLine.jsx`, `planetTextures.js`, `MoonTrail.jsx`.

- Sol, ocho planetas y Luna con **radios volumétricos medios** (NASA/JPL) a escala real.
- Órbitas **elípticas** con el Sol en un foco y cada planeta **en su posición de la fecha en que se abre la página**. Elementos keplerianos medios y sus tasas por siglo de JPL («Approximate Positions of the Planets», tabla 1, válida de 1800 a 2050): semieje a, excentricidad e, inclinación i, longitud media L, longitud del perihelio ϖ y longitud del nodo Ω, en la eclíptica J2000. Con T en siglos julianos desde J2000, cada elemento vale `valor + tasa · T`, y después:

```
ω = ϖ − Ω                 M = L − ϖ                 M = E − e · sen E   (Newton)
x' = a · (cos E − e)      y' = a · √(1 − e²) · sen E
u = x' · cos ω − y' · sen ω          v = x' · sen ω + y' · cos ω
x_ecl = cos Ω · u − sen Ω · cos i · v
y_ecl = sen Ω · u + cos Ω · cos i · v
z_ecl = sen i · v
```

seguido del giro eclíptica → ecuatorial del apartado 4. La línea dibujada es la elipse de esos mismos elementos en esa fecha.

- **Precisión:** para el 14/10/2026 las ocho posiciones coinciden con los vectores de JPL Horizons a menos de 0,08° vistas desde el Sol (0,002° en Mercurio, 0,07° en Saturno); es el error propio de los elementos aproximados. La fila de la Tierra es la del baricentro Tierra-Luna; la Tierra se coloca separada de él en sentido opuesto a la Luna, según la razón de masas 81,30056.
- **Luna:** en su posición y a su distancia de la misma fecha, con la serie de baja precisión del *Astronomical Almanac* (longitud y latitud eclípticas y paralaje), llevada a J2000 restando la precesión general. Frente a JPL Horizons, el 14 y el 22/10/2026: 0,06° de dirección y menos de 600 km de distancia.
- **Límites:** los planetas no avanzan mientras la página está abierta; la fecha se toma al cargarla y figura en la ficha de cada planeta. La Luna tampoco avanza; su órbita se dibuja como una estela del mismo color que las de las lunas de Júpiter y Saturno, que recorre el 90 % del último mes sideral con la misma serie que la coloca y se desvanece hacia atrás. De cerca la Luna no lleva marca; desde 0,01 UA la señala el hexágono de las sondas. Las líneas de órbita son un estilo de presentación: su ancho y brillo no representan nada. En el sistema solar son una franja azul oscuro muy fina y difuminada, y cada planeta lleva un círculo hueco y su nombre en mayúsculas espaciadas; en los exoplanetas, un trazo fino con halo.
- **Cielo desde el sistema solar:** cerca del Sol las estrellas tienen un mínimo de exposición (`skyExposure` en `scale.js`) para que se vea un cielo estrellado; es una decisión de presentación, no fotometría. Texturas de Solar System Scope para el Sol, los ocho planetas y la Luna. Cada esfera se orienta con el polo de rotación y el meridiano cero de la IAU (WGCCRE 2015) en la fecha de carga, `W = W0 + Ẇ · d` con d en días desde J2000: la Tierra muestra iluminado el lado donde es de día (el 19/10/2026 a las 15:00 UTC, el Sol en el cenit sobre 48,6° O y 10° S) y la Luna vuelve hacia la Tierra su cara visible, con unos grados de libración. En los planetas gaseosos el giro es real, pero el mapa de nubes no corresponde a ninguna fecha.

Capas del entorno solar, todas **ilustrativas** salvo sus distancias:

| Capa | Distancias | Representación |
| --- | --- | --- |
| Cinturón de Kuiper | 30–50 UA | 22.000 puntos sintéticos |
| Heliosfera | nariz ≈ 107 UA, hueco entre lóbulos ≈ 370 UA, lóbulos ≈ 510 UA (norte) y ≈ 800 UA (sur) | Heliopausa translúcida estática con la forma de «croissant» del modelo de Opher, digitalizada de los cortes meridional y ecuatorial publicados por Kornbleuth et al. (2021, ApJ 923, 179) e interpolada entre ambos, orientada al viento interestelar medido por IBEX (λ 255,8°, β +5,16°) y anclada a los cruces de las Voyager (121,6 UA en 2012 y 119,0 UA en 2018, posiciones de JPL Horizons). Los lóbulos y la cola son de modelo; la forma real sigue en debate |
| Voyager 1 y 2, Pioneer 10 y 11 | ≈ 172, 144, 142 y 118 UA en octubre de 2026 | Posición de JPL Horizons en la fecha de carga; hexágono y cola ilustrativos (ver «Sondas») |
| Nube de Oort | 2.000–100.000 UA | 140.000 partículas sintéticas |

### Sondas

Archivos: `probeTrajectories.js`, `ProbeComets.jsx`, `ProbeTrails.jsx`; datos en `public/data/probes.json`.

- **Fuente:** vectores heliocéntricos de JPL Horizons (centro del Sol, ICRF, UA) de Voyager 1 (−31), Voyager 2 (−32), Pioneer 10 (−23) y Pioneer 11 (−24), desde el lanzamiento hasta el 31/12/2049, cada 2 días; se guarda una muestra cada 8 días redondeada a 10⁻⁴ UA (≈ 15.000 km).
- **Posición:** interpolación lineal en la fecha en que se abre la página. Después de perder la señal (Pioneer 11 en 1995, Pioneer 10 en 2003) y en el futuro, Horizons da la trayectoria calculada, no seguida. Pasada la fecha final, cada sonda queda en su último punto.
- **En pantalla:** un hexágono hueco marca la sonda y una cola de cometa recorre hacia atrás su trayectoria real, desde la posición de la fecha hasta el punto en que la sonda estaba al 48,25 % de su distancia actual; se estrecha y se vuelve transparente hacia el Sol. Gris tenue; al pasar el ratón por el nombre, la cola, el hexágono y el nombre se aclaran. Ancho, brillo y largo son de presentación.
- **Rutas completas:** `ProbeTrails.jsx` dibuja toda la trayectoria desde el lanzamiento, con sus pasos por los planetas, como una estela que se apaga hacia el pasado. Está preparado para activarse más adelante (`probeRoutes` en `SolarSystem.jsx`) y hoy no se muestra.
- **Comprobación:** las pruebas verifican que cada trayectoria parte a menos de 0,01 UA de la Tierra y pasa a menos de 0,05 UA de Júpiter, Saturno, Urano y Neptuno en las fechas de sus nueve encuentros, frente a posiciones de Horizons.

### Lunas de Júpiter y Saturno

Archivos: `moonEphemeris.js`, `moonBodies.js`, `Moons.jsx`, `MoonLabels.jsx`, `FichaLuna.jsx`; datos en `public/data/moons.json` (generador `scripts/moons/build_moons.js`).

- **Cuáles:** las 406 lunas con elementos medios publicados por JPL (115 de Júpiter y 291 de Saturno), seleccionables desde su nombre o desde el grupo «Lunas de …» del selector.
- **Tamaño:** 25 con radio medio de JPL, 21 con diámetro medido publicado (Thomas, Grav et al.) y 360 con diámetro **estimado por su brillo** (magnitud absoluta y albedo supuesto; puede errar en un factor de dos). La ficha dice cuál es cuál.
- **Posición, lunas exteriores** (a > 1,4 millones de km: Calisto, Hiperión, Jápeto, Febe y todas las irregulares): el Sol las perturba tanto que una elipse media se aparta grados en semanas. Se guardan los elementos osculadores de JPL Horizons cada 60 días entre el 01/09/2026 y el 01/01/2030 y se propaga como órbita de dos cuerpos desde el conjunto más cercano, como mucho 30 días (< 0,1°).
- **Posición, lunas interiores:** forma, plano (de Laplace) y periodos de precesión de los elementos medios de JPL; la anomalía media inicial, el movimiento medio, el nodo y el periápside se ajustan por mínimos cuadrados a 25 posiciones de Horizons tomadas cada 15 días durante un año. Propagados solos desde el año 2000, los elementos medios se desvían decenas de grados: sus periodos tienen siete cifras y la tabla no publica el sentido de las precesiones.
- **Precisión** frente a Horizons en una fecha que no se usó al ajustar (14/02/2027): menos de 0,9° en las lunas comprobadas, salvo Mimas (2°). Las lunas pequeñas que oscilan alrededor de otra (Helena, Pólux, Anthe, Metone, Calipso) llegan a 2–8°. Dafnis no tiene efeméride de Horizons después de 2018 y su posición es aproximada.
- **En pantalla:** esferas a escala, color ilustrativo e iluminadas por el Sol; de lejos, un punto fijo que no representa el radio. Cada una deja una estela beige con su trayectoria real del último 90 % de su vuelta, que se desvanece hacia atrás; en las lunas exteriores lentas el tramo anterior al 01/09/2026 se extrapola. A Júpiter y Saturno se llega desde el lado del Sol, 30° por encima del plano de sus lunas.

### Anillos de Saturno

Archivos: `ringParticles.js`, `SaturnRings.jsx`; datos en `public/data/saturn_rings.json` (generador `scripts/rings/build_rings.js`).

- **Dato:** la profundidad óptica normal τ cada 10 km de 74.400 a 140.700 km, medida por Cassini UVIS en la ocultación de la estrella β Centauri del 18/08/2008 (PDS, `UVIS_HSP_2008_231_BETCEN_I_TAU10KM`). Ahí están el anillo C tenue, el B casi opaco (τ hasta ≈ 10), la división de Cassini, el A con las divisiones de Encke y Keeler y el anillo F. Bordes y albedos, de la ficha de anillos de NASA.
- **Representación:** los anillos tienen del orden de 10¹⁶ a 10¹⁸ trozos de hielo de centímetros a metros; Hoshi dibuja 306.000 puntos, repartidos para que la cantidad en cada radio siga la luz que el anillo intercepta, `(1 − e^(−τ)) · 2πr`. Cada punto cubre en pantalla `S·μ / (N·θ²·d²)` de su píxel (S, área efectiva; μ, inclinación de la mirada; θ, ángulo de un píxel; d, distancia), así que el anillo tiene la misma opacidad vista de lejos que de cerca y tapa al planeta en esa proporción. Cuando el anillo se ve pequeño se dibuja solo una parte de los puntos (unos 6 por píxel).
- **Espesor:** unos 10 m frente a 280.000 km de diámetro, como una hoja de papel de un kilómetro de ancho; no llega a un píxel y los puntos están en el plano ecuatorial (polo IAU de Saturno).
- **Luz:** sombra del planeta sobre los anillos; la cara que no ilumina el Sol se aproxima con la luz que atraviesa, `τ e^(−τ) / (1 − e^(−τ))`, por lo que desde ella el anillo B, el más denso, se ve oscuro. En 2026 el Sol está 7,9° al sur del plano de los anillos. El anillo D, casi transparente (τ ≈ 10⁻⁵), lleva más puntos de los que le corresponderían para que se vea; tamaño y color de los puntos no son medidas.

### Superficie del Sol y filtros

Archivos: `StellarSurface.jsx`, `stellarSurfaceModel.js`, `PlasmaLoops.jsx`, `filtroEstelar.js`, `sdoSolar.js`, `solarChromosphereMap.js`; imágenes en `public/textures/sdo/` (generador `scripts/sdo/descargar_sdo.mjs`).

- **Superficie simulada:** gránulos, manchas con umbra y penumbra, oscurecimiento del borde y arcos de plasma en las regiones activas, con medidas solares escaladas a la temperatura y el radio de cada estrella; el tiempo va 60 veces más rápido. Es una ilustración, no una observación. «Sin filtro», la estrella deslumbra: los rayos representan la luz que desborda al mirarla, no la corona.
- **Filtros del SDO (solo en el Sol):** cada filtro es un canal real del Solar Dynamics Observatory: luz visible de HMI («sin filtro NASA»), 131 Å (vídeo de las últimas 48 h), 171, 193 y 304 Å de AIA, la composición 211/193/171 Å que publica el SDO, la composición 304/211/171 Å armada aquí con el brillo de cada canal en rojo, verde y azul, y el magnetograma de HMI. Por defecto, 193 Å.
- **Geometría:** el SDO orbita la Tierra y solo ve la cara del Sol que mira hacia ella. La imagen se proyecta sobre esa cara para la fecha de cada imagen: dirección Sol-Tierra de las efemérides de JPL, norte solar del polo IAU (AR 286,13°, Dec 63,87°) arriba y oeste a la derecha. El radio del disco en la imagen es el radio angular del Sol (≈ 963″ en octubre) dividido por el semicampo del instrumento (AIA: 2048 × 0,6″; HMI: 2048 × 0,504″); medido en las imágenes, coincide al 0,1 %.
- **Cara oculta:** recibe el reflejo en espejo de la visible, de modo que la esfera queda completa y sin costura en el borde; no es una observación. Junto al borde del disco la imagen se estira y se lee desenfocada. En luz visible se usa la imagen aplanada de HMI y se repone el oscurecimiento del borde según el ángulo de la cámara (brillo ≈ 0,53 × cos θ, medido en la imagen sin aplanar).
- **Resplandor:** con un filtro del SDO toma el color medido de la corona justo fuera del disco en cada imagen.
- **Descarga:** el script baja las imágenes de 2048 px y una copia del vídeo de 131 Å reducida a 768 px (≈ 0,9 MB; el original pesa ≈ 70 MB y el servidor del SDO no permite usarlo desde otra web). Se niega a repetir antes de 15 minutos, como pide el SDO. `sdo.json` guarda la fecha de cada imagen, que se muestra en pantalla.
- **En otras estrellas** los filtros muestran la simulación de la capa equivalente (fotosfera, cromosfera, corona o campo magnético).

## 7. Estrellas

### Catálogo

Fuente: AT-HYG v3.2 (compilación de Hipparcos, Gaia y otros catálogos). `scripts/process_stars.js` produce `data/processed/stars_15pc.json` con 122.284 estrellas (el nombre del archivo es heredado: no se limita a 15 pc): 118.660 de AT-HYG y 3.624 anfitrionas de exoplanetas añadidas. Campos: identificador, nombre, x, y, z, distancia, magnitud absoluta, índice de color B−V, tipo espectral y color RGB.

### Enlace con Gaia DR3 y correcciones de distancia

Archivos: `scripts/catalog/`. AT-HYG no trae identificadores de Gaia. Se enlazan de dos maneras:

- **Por número Hipparcos**, con la tabla de vecinos del propio Gaia: 99.274 estrellas.
- **Por posición**, con el servicio CDS XMatch: la posición J2000 se lleva a la época 2016.0 con el movimiento propio y se busca en 5″. Un par se acepta si la paralaje es compatible con la distancia del catálogo y la magnitud V predicha desde G y BP−RP (Riello et al. 2021) coincide a ±1 mag; si hay dos candidatos válidos se descarta. Así se enlazan 18.773 más.

Total: **118.047 de 118.660 estrellas (99,5 %)**. Las 613 restantes son estrellas muy brillantes, que Gaia no mide, o cruces ambiguos.

La distancia del catálogo se sustituye por la de Gaia (`d = 1000 / paralaje`) solo si se cumple todo esto: paralaje con error relativo menor del 10 %, RUWE < 1,4 (astrometría de estrella simple), G > 5 (sin saturación), diferencia mayor del 10 %, enlace sin ambigüedad y magnitud coherente. Lo cumplen **31 estrellas**; otras 191 discrepan pero se dejan como están, casi siempre porque Gaia las señala como posibles binarias. Al corregir se conserva la dirección y se recalcula la magnitud absoluta.

Las diferencias grandes no son dos medidas de la misma estrella. HIP 31821 figuraba a 1.201 pc y pasa a 47,9 pc: es una enana K1 de magnitud 8,4, que a 1.201 pc tendría que ser una gigante; el valor antiguo corresponde a otra estrella, de fondo, a unos 15″.

### Anfitrionas de exoplanetas añadidas

AT-HYG está limitado por brillo y no incluye muchas enanas rojas con planetas (TRAPPIST-1, la estrella de Teegarden). Se añaden 3.624, con identificador a partir de 9.000.001:

| Dato | Procedencia |
| --- | --- |
| Posición | Gaia DR3 llevada de 2016.0 a J2000 con su movimiento propio (3.564); el resto, del NASA Exoplanet Archive |
| Distancia | Paralaje de Gaia con error menor del 10 % (3.503); si no, la del archivo (121) |
| Magnitud V | Desde G y BP−RP de Gaia (3.571); si no, la del archivo |
| B−V y color | Inversa numérica de la fórmula de Ballesteros a partir de la temperatura publicada |

Solo las 119 situadas a 50 pc o menos muestran su nombre en la escena; todas se encuentran con el buscador.

### Color

Temperatura efectiva desde el índice B−V (Ballesteros 2012):

```
T = 4600 · ( 1/(0,92·(B−V) + 1,7) + 1/(0,92·(B−V) + 0,62) )  K
```

y de temperatura a sRGB con la aproximación de cuerpo negro de Tanner Helland. Una estrella sin B−V se dibuja blanca: no se le inventa un color.

### Brillo en pantalla

El tamaño y la intensidad de cada punto son una representación comprimida de la magnitud absoluta M, no una simulación fotométrica ni un radio:

```
peso = límite( 2^((1,3 − M) · 0,15), 0,45, 1,5 )
```

### Radio y temperatura estimados

Archivo: `stellarPhysics.js`. Solo para estrellas con nombre, tipo espectral B, A, F, G o K, y −0,3 ≤ B−V ≤ 1,5:

1. Temperatura con la fórmula de Ballesteros (se descarta fuera de 4.000–30.000 K).
2. Corrección bolométrica BC(T) con los polinomios de Flower (1996) corregidos por Torres (2010).
3. Luminosidad, calibrada de forma diferencial con el Sol (M_V☉ = 4,81, T☉ = 5.772 K):

```
L/L☉ = 10^( 0,4 · (M_bol☉ − M_V − BC(T)) )
```

4. Radio por la ley de Stefan-Boltzmann:

```
R/R☉ = √(L/L☉) · (T☉/T)²
```

Se rechazan resultados fuera de 0,01–2.000 R☉. El método no vale para enanas M, Wolf-Rayet, estrellas de carbono ni sistemas sin resolver. Son 362 estimaciones; la interfaz las rotula «estimado». Próxima Centauri usa valores publicados (Ribas et al. 2017) y se rotula «publicado».

### Objetos curados

Eta Carinae no figura en el catálogo y se añade como registro aparte (coordenadas de SIMBAD, distancia de 7.500 años luz de NASA). WR 140 usa su registro del catálogo y un modelo orbital propio de dos componentes (Thomas et al. 2021).

## 8. Sistemas múltiples

Archivos: `scripts/process_binaries.js`, `src/scene/visualBinary.js`, `CompanionStars.jsx`.

Al acercarse a una estrella que en realidad es un sistema, sus compañeras se separan del punto del catálogo. El índice tiene 5.786 sistemas y 7.037 componentes.

| Fuente | Aporta |
| --- | --- |
| ORB6, Sixth Catalog of Orbits of Visual Binary Stars (USNO) | Elementos orbitales; se usan los grados 1 a 3 |
| WDS, Washington Double Star Catalog (USNO) | Pares físicos sin órbita, magnitudes y tipos espectrales |
| MSC, Multiple Star Catalog (Tokovinin) | Jerarquías y masas estimadas de sistemas de tres o más estrellas |
| SB9, catálogo de binarias espectroscópicas | Razón de masas de binarias de doble línea |
| Publicaciones | Masas dinámicas de Sirio (Bond et al. 2017) y Procyon (Bond et al. 2015) |

### Órbita relativa

Con período P, época de periastro T, excentricidad e, semieje a, inclinación i, nodo Ω y argumento del periastro ω:

```
Anomalía media        M = 2π · (t − T) / P
Ecuación de Kepler    E − e · sen E = M          (se resuelve por Newton)
En el plano orbital   X = a · (cos E − e)         Y = a · √(1 − e²) · sen E
Giro por ω            u = X cos ω − Y sen ω       v = X sen ω + Y cos ω
Plano del cielo       norte = u cos Ω − v sen Ω cos i
                      este  = u sen Ω + v cos Ω cos i
                      fondo = v sen i
```

El semieje en UA es el semieje angular en segundos de arco multiplicado por la distancia en parsecs. La base norte/este/fondo se pasa al marco ecuatorial con la dirección (α, δ) de la estrella:

```
x = −este · sen α − norte · sen δ · cos α + fondo · cos δ · cos α
y =  este · cos α − norte · sen δ · sen α + fondo · cos δ · sen α
z =  norte · cos δ + fondo · sen δ
```

El modelo es estático: todas las órbitas se evalúan en una fecha fija, el 18/09/2026.

### Centro de masas

Cuando se conocen las masas m₁ y m₂, con q = m₂/(m₁+m₂) y r el vector de la primaria a la compañera:

```
primaria  = centro − q · r
compañera = centro + (1 − q) · r
```

Se dibujan las dos elipses en torno al centro de masas. Ninguna estrella cambia de sitio: solo cambia la curva. En binarias espectroscópicas de doble línea la razón de masas se mide con las amplitudes de velocidad, m₂/m₁ = K₁/K₂, y la masa total es la dinámica:

```
m₁ + m₂ = a³ / P²        (a en UA, P en años, masas en M☉)
```

### Pares sin órbita y jerarquías

Un par ancho se coloca a su separación ρ y ángulo de posición θ observados: norte = ρ cos θ, este = ρ sen θ, fondo = 0, porque la profundidad relativa no se conoce. Cada par se ancla en su componente: en Castor, Ab y B giran en torno a A, y Bb en torno a B.

### Qué es marcador

La compañera se dibuja como un punto de 4 a 14 px según su magnitud absoluta, con color por clase espectral cuando el catálogo la da. No es un radio estelar. Si la compañera ya es una estrella del catálogo (Toliman, Alcor, Próxima) se usa ese registro.

**Límites:** la primaria conserva su posición de catálogo; el signo del eje de fondo es ambiguo cuando el nodo ascendente no está identificado; la distancia del catálogo fija la escala de todo el sistema; las compañeras sin orientación medida (espectroscópicas) se listan en la ficha pero no se dibujan.

## 9. Sistemas planetarios

Archivos: `src/scene/exoplanetOrbit.js`, `src/scene/PlanetarySystem.jsx`, `scripts/exoplanets/`, `scripts/catalog/`.

### Fuente y alcance

NASA Exoplanet Archive, tabla `pscomppars`: un registro por planeta confirmado, que combina el mejor valor publicado de cada parámetro. Es una tabla compuesta: un planeta puede tener el período de un artículo y la excentricidad de otro.

Se dibujan **4.533 sistemas con 6.125 planetas**. Quedan fuera 307 sistemas cuya estrella no puede situarse (281 son lentes de microlente sin estrella catalogada) y 2 planetas sin semieje ni período utilizable.

### Qué es medido y qué es supuesto

Cada planeta lleva la lista de sus valores que no son una medida de la tabla, y la ficha la muestra.

| Dato | Planetas con el dato de la tabla | Qué se hace si falta |
| --- | ---: | --- |
| Período | 6.062 | Se calcula con la 3.ª ley de Kepler (63) |
| Semieje mayor | 5.642 | Se calcula con la 3.ª ley de Kepler desde el período y la masa de la estrella (483) |
| Excentricidad distinta de cero | 2.216 | 3.142 valen 0 en la tabla (suele ser un valor fijado en el ajuste) y 767 no la traen: órbita circular |
| Inclinación respecto al cielo | 4.828 | Tránsito sin valor: 90° (339). Sistema con otros planetas medidos: su mismo plano (160). Resto: 60°, la mediana de orientaciones al azar (798) |
| Argumento del periastro | — | Sin valor y con excentricidad: 0° (399) |
| Posición en la órbita (fase) | 5.833 | Se dibuja en el periastro y se rotula «posición ilustrativa» (292) |
| Radio | 4.842 medidos | 1.235 estimados por el archivo con una relación masa-radio; 48 sin radio, solo marcador |
| Longitud del nodo ascendente (Ω) | 0 | Convencional (0°) en todos |

Resumen por nivel de fidelidad de la órbita:

| Nivel | Planetas |
| --- | ---: |
| Tamaño, forma, inclinación y fase de la tabla (solo Ω es convencional) | 1.005 (720 además con radio medido) |
| Inclinación medida, con forma circular supuesta o algún otro valor calculado | 3.823 |
| Sin inclinación medida (velocidad radial, imagen o tránsito sin valor) | 1.297 |

**Ningún planeta tiene su órbita completa en 3D.** Ω, el giro del plano orbital alrededor de la línea de visión, no figura en la tabla. Son reales el tamaño de la órbita, su forma y, cuando se conoce, la inclinación respecto al cielo. El color, las nubes, los anillos y las lunas no se conocen en ningún caso: los planetas son esferas grises con un leve matiz por temperatura de equilibrio.

### Sistemas circumbinarios

En 34 de los sistemas dibujados los planetas giran alrededor de dos estrellas (marca `cb_flag` del archivo). La tabla de la NASA solo describe a la primaria y no trae la órbita de la binaria, así que esos datos proceden de una tabla curada con el artículo de cada sistema: `scripts/exoplanets/circumbinary_hosts.js`, con la referencia de cada fila.

| Grupo | Sistemas | Qué se dibuja |
| --- | ---: | --- |
| Binarias eclipsantes con órbita medida (Kepler-16, 34, 35, 38, 47, 413, 453, 1647, 1660 y 1661, PH1, TOI-1338, TIC 172900988, BEBOP-3 y BEBOP-4) | 15 | Las dos estrellas en su órbita y en su fase, con radios y temperaturas publicados |
| Binarias compactas de enana blanca o subenana y enana roja (NN Ser, HU Aqr, UZ For, DP Leo, RR Cae, DE CVn, NY Vir, NSVS 14256825 y Kepler-451) | 9 | Órbita circular de pocas horas; la posición de las estrellas en ella es ilustrativa |
| Binarias de planetas fotografiados con órbita (VHS 1256-1257 y Ross 458) | 2 | Órbita del par; en Ross 458 la orientación de la elipse es supuesta |
| Sin órbita publicada o incorporada (HD 143811, HD 284149, b Cen, HIP 79098, ROXs 42 B, WISPIT 1, 2MASS J0103-5515 y 2MASS J0249-0557) | 8 | Un solo punto; la ficha lo declara |

El punto del catálogo es el par sin resolver y se toma como su centro de masas. Con `r` la posición de B respecto de A y `q = m_B / (m_A + m_B)`, las estrellas quedan en `r_A = −q·r` y `r_B = (1 − q)·r`, y los planetas siguen centrados en ese punto. La órbita relativa usa la misma geometría que la de un planeta, con el argumento del periastro en la convención de eclipses: B pasa por delante de A en la anomalía verdadera `90° − ω`. La fase se fija con el tiempo del eclipse primario o del periastro. Como en los planetas, el giro del plano en el cielo (Ω) es convencional salvo en VHS 1256-1257, cuya órbita visual lo mide; por eso la inclinación mutua entre la binaria y sus planetas solo es fiel en la componente que mide la inclinación respecto al cielo.

Cada estrella con radio y temperatura publicados se dibuja como esfera a escala y es un destino de viaje; si falta alguno de los dos, queda como marcador y la ficha dice cuál falta (la secundaria de 9 sistemas: BEBOP-3, BEBOP-4, NN Ser, RR Cae, HU Aqr, UZ For, DP Leo, Ross 458 y VHS 1256-1257). Lo supuesto se declara igual que en los planetas: semieje calculado con la 3.ª ley de Kepler (9 sistemas), órbita circular adoptada (9), posición ilustrativa (10), inclinación aproximada (BEBOP-4), orientación de la elipse (Ross 458) y masas iguales (VHS 1256-1257, donde solo se publica la masa total).

### Geometría

Posición en el plano de la órbita, con `E` la anomalía excéntrica:

```
x = a (cos E − e)        y = a √(1 − e²) sen E
```

Giro por `ω + 180°`, `i` y `Ω` al plano del cielo (norte, este, visual) y de ahí al marco ecuatorial con la ascensión recta y la declinación de la estrella. Es la misma transformación de la sección 8. El `ω` de la tabla es el de la órbita de la estrella, y el planeta está en el lado opuesto: de ahí los 180°.

**Fase.** Con un tránsito central `t0`, se busca numéricamente el punto de la órbita dibujada cuya dirección queda más cerca de la del Sol, y desde ahí se avanza con el período hasta la fecha del modelo (18/09/2026):

```
M(t) = M_tránsito + 2π (t − t0) / P
```

Con un tiempo de periastro, `M = 0` en esa fecha. Un tiempo de periastro idéntico en varios planetas de un sistema (GJ 876) es la época de un ajuste dinámico, no un periastro, y no se usa. La posición resultante es la que predicen los valores publicados, propagada miles de órbitas; no es una efeméride.

### En pantalla

- Las órbitas y los nombres aparecen al acercarse, según el tamaño aparente de cada órbita.
- De lejos cada planeta es un marcador de tamaño fijo. De cerca es una esfera con su radio físico (`radio × 6.378,1 km`), iluminada desde su estrella.
- Al llegar a una estrella con planetas, la cámara queda a 64° de la normal del plano orbital (26° sobre el plano), con el plano horizontal en pantalla: las órbitas se ven en perspectiva, abiertas y con profundidad; el giro termina antes de que se distingan las órbitas. Al elegir un planeta, la cámara queda a 10 radios, del lado opuesto a su estrella y algo por encima del plano orbital, con el planeta en primer plano y la estrella detrás; a esa distancia la cámara está casi en el plano y las órbitas se ven de canto. Es solo la posición de la cámara: el catálogo no se gira.
- Los planetas con radio se pueden elegir desde su nombre o desde el selector «Acercarse a», como los del sistema solar.
- La estrella anfitriona usa el radio y la temperatura publicados en el archivo (4.507 estrellas).

### Mapa de descubrimientos

El botón «Exoplanetas» abre un modo inspirado en Eyes on Exoplanets de la NASA: las estrellas del catálogo y la Vía Láctea se atenúan y cada estrella con planetas conocidos se marca con un destello de cuatro puntas, de tamaño fijo en pantalla y algo mayor cuantos más planetas pasan el filtro (`ExoplanetDiscoveries.jsx`, `descubrimientos.js`, `PanelDescubrimientos.jsx`).

- **Datos** (`public/data/exoplanet-discoveries.json`, ≈ 0,7 MB; solo se descarga al abrir el modo): 6.424 planetas confirmados de `pscomppars` y 8.057 candidatos: TOI de TESS con disposición PC o APC del TFOPWG (5.151), KOI de Kepler «CANDIDATE» (1.971) y candidatos de K2 de `k2pandc` (935). En total 12.134 sistemas; 516 candidatos orbitan estrellas que ya tienen planetas confirmados y se suman a ellas (por TIC, KIC o EPIC). Los confirmados que están en Hoshi usan la posición de su estrella del catálogo; los demás, ascensión recta, declinación y distancia del archivo (para los KOI, la distancia de `keplerstellar`, DR25). Quedan fuera 21 confirmados y 207 candidatos sin distancia.
- **Estado:** todos, confirmados o candidatos. Un sistema solo con candidatos lleva un anillo y rayos más cortos.
- **Tipo de planeta:** gigante gaseoso, tipo Neptuno, supertierra o terrestre, las categorías del catálogo de la NASA. Para los confirmados se usa el tipo de la ficha de cada planeta en `science.nasa.gov/exoplanets/exoplanet-catalog` (6.287 planetas). La NASA no publica sus límites, así que para candidatos y planetas sin ficha se ajustó una regla a esas fichas: gigante gaseoso desde 0,12 MJ (38,14 M⊕); tipo Neptuno desde 2,1 R⊕; supertierra desde 1 R⊕. El gigante se decide por masa cuando la hay (la NASA llama «tipo Neptuno» a planetas hinchados de poca masa, como WASP-107 b); los otros límites, por radio si lo hay. Sin radio o sin masa, cada límite se convierte con la relación masa-radio de Chen y Kipping (2017), la que usa el archivo para sus masas calculadas: 1 / 5,06 / 38,14 M⊕ equivalen a 1 / 2,1 / 6,9 R⊕. La regla coincide con el 96,2 % de las fichas; es una convención, no una propiedad medida.
- **Misión:** instalación de descubrimiento (`disc_facility`): Kepler, K2, TESS, CoRoT, Gaia, otros telescopios espaciales (Hubble, Spitzer, CHEOPS, JWST, WISE y descubrimientos con varias instalaciones) y observatorios en tierra (`disc_locale`). Los candidatos pertenecen a la misión de su tabla.
- **Color:** por defecto, el de la estrella según su temperatura efectiva (como en Eyes); también por tipo del planeta mayor que pasa el filtro o por misión. Los recuentos de cada pestaña se calculan con los filtros de las otras dos filas activos.
- Al pasar el puntero sobre un destello aparecen su nombre, distancia, planetas por tipo y misión; con un clic se viaja al sistema si su estrella está en Hoshi. Al abrir el modo, la cámara se aleja a 2.400 pc del Sol con la vertical en el polo norte galáctico; las posiciones no se rotan.
- En el modo las estrellas del catálogo brillan al 8 % y la Vía Láctea al 32 %; los destellos casi no pierden tamaño ni brillo de lejos, para que destaquen sobre el disco.
- Los destellos son ilustrativos: no indican tamaño ni brillo de la estrella.

## 10. Vía Láctea y púlsares

**Galaxia** (`galaxy.js`, `MilkyWay.jsx`). Es una **reconstrucción ilustrativa**, no un catálogo 3D medido. Parte de la imagen frontal de la Vía Láctea de ESA/Gaia/DPAC (Stefan Payne-Wardenaar): hasta 55.000 partículas se muestrean por rechazo sobre el brillo de la imagen y reciben espesor con una distribución gaussiana, mayor en el bulbo. La imagen abarca 40.610 pc de lado, registrada para que el vecindario solar caiga a 8.122 pc del centro. Aparece entre 1.800 y 7.000 años luz del Sol.

**Púlsares** (`pulsarData.js`, `PulsarMap.jsx`). Los 14 púlsares del mapa de las placas Pioneer y Voyager, con coordenadas y distancias del catálogo ATNF. Las líneas unen el Sol con cada púlsar; los trazos discontinuos son decorativos y no codifican períodos.

## 11. Navegación

### Viajes

Archivos: `navigation.js`, `starJourney.js`. Un viaje interpola la distancia al destino en **escala logarítmica**, para que recorrer de la Tierra a la galaxia tenga un ritmo perceptible en todo el trayecto:

```
d(t) = exp( (1 − s) · ln d_inicio + s · ln d_fin )
```

donde s es el progreso suavizado: 22 % del tiempo acelerando, 40 % a ritmo sostenido y 38 % frenando, con velocidad y aceleración continuas en las uniones. La dirección gira por interpolación esférica y la vertical de cámara se interpola con la misma curva.

| Acción | Duración |
| --- | --- |
| Buscador, selector y vistas de escala | 8 s |
| Mapa de púlsares | 6,4 s |
| Vía Láctea | 12,8 s |
| Escala lateral | 2 s |
| Fijar rumbo a una estrella o al Sol (sin traslado) | 1,25 s |

### Escala lateral

Archivo: `escalaNavegacion.js`. Convierte un valor de 0 a 100 en distancia a la Tierra con tramos logarítmicos entre marcas: Tierra (0), Kuiper (12, 40 UA), heliosfera (21, 120 UA), nube de Oort (32, 1 año luz) y Vía Láctea (100, 200.000 años luz). Dentro de cada tramo:

```
d = d_cerca · (d_lejos / d_cerca)^((v − v_inicio) / (v_fin − v_inicio))
```

No es una escala lineal: el entorno solar ocupa el tercio inferior a propósito.

### Cámara orbital

Fuera del vuelo libre la cámara gira con inercia (amortiguación 0,06) y la rueda acerca con inercia (`ZoomSuave.jsx`, `inerciaCamara.js`): cada muesca da un impulso que frena exponencialmente (λ = 5,5 s⁻¹) y cambia en total un 11 % el logaritmo de la distancia, igual a cualquier frecuencia de cuadros. Los gestos táctiles siguen siendo los de OrbitControls.

### Vuelo libre

Archivos: `FreeFlight.jsx`, `flightMotion.js`, `controlVelocidad.js`. La rueda y el dial eligen la **velocidad**, no la posición. El dial es logarítmico entre 10⁻¹⁴ pc/s y 15.000 años luz/s:

```
v = v_mín · (v_máx / v_mín)^(valor / 100)
```

Las velocidades son de navegación: superan la de la luz sin pretender realismo físico. Cerca de una estrella con rumbo fijado hay frenado automático: se detiene a 1,15 radios si el radio es conocido y a 0,001 UA si no.

### Límites

El vuelo libre no supera 200.000 años luz del Sol, y la órbita de cámara no supera esa distancia respecto de su objetivo. Los viajes automáticos no recortan destinos: unas pocas estrellas del catálogo quedan más allá y se puede llegar a ellas.

## 12. Datos y generadores

Los generadores se ejecutan a mano desde la raíz; no forman parte del build.

| Comando | Entrada | Salida |
| --- | --- | --- |
| `node scripts/process_stars.js` | `data/raw/hyglike_from_athyg_v32.csv` | `data/processed/stars_15pc.json` |
| `node scripts/process_stellar_physics.js` | El mismo CSV | `data/processed/stellar_physics.json` |
| `node scripts/process_star_search.js` | CSV y catálogo procesado | `public/data/star-search.json` |
| `node scripts/process_binaries.js` | `data/raw/multiplicity/` | `data/processed/star_systems.json` |
| `node scripts/exoplanets/process_exoplanets.js` | Tabla de la NASA | `data/exoplanets/exoplanet_systems.json` |
| `python3 scripts/catalog/cruzar_gaia_posicion.py` | AT-HYG, CDS XMatch, Gaia | `data/raw/gaia/gaia_dr3_posicion.csv` |
| `node scripts/catalog/build_star_identity.js` | AT-HYG, Gaia, SIMBAD, NASA | `data/catalog/star_identity.json` y anfitriones |
| `node scripts/catalog/build_distance_corrections.js` | Identidad estelar | `data/catalog/distance_corrections.json` |
| `node scripts/catalog/build_added_hosts.js` | Anfitriones y Gaia | `data/catalog/added_hosts.json` |
| `node scripts/exoplanets/build_planet_scene.js` | Los anteriores | `public/data/exoplanets.json` |
| `node scripts/probes/fetch_horizons.mjs` | JPL Horizons (descarga) | `data/probes/fuentes/*.csv` |
| `node scripts/probes/build_probes.js` | `data/probes/fuentes/` | `public/data/probes.json` |
| `node scripts/moons/build_moons.js` | `data/moons/fuentes/`: tablas de JPL (elementos medios y parámetros físicos), tamaños compilados en Wikipedia y elementos y vectores de JPL Horizons | `public/data/moons.json` |
| `node scripts/sdo/descargar_sdo.mjs` | Imágenes «latest» y vídeo de 48 h del SDO (descarga; requiere ffmpeg para el vídeo) | `public/textures/sdo/` |
| `node scripts/rings/build_rings.js` | `data/rings/fuentes/`: perfil de Cassini UVIS (PDS) | `public/data/saturn_rings.json` |
| `python3 -I scripts/exoplanets/fetch_nasa_catalog_types.py <salida>` | Catálogo de exoplanetas de la NASA | `data/raw/exoplanets/nasa_science_catalog_types.csv` |
| `node scripts/exoplanets/build_discoveries.js` | Tablas de la NASA (confirmados, TOI, KOI, K2) y catálogo procesado | `public/data/exoplanet-discoveries.json` |

Orden al actualizar los exoplanetas: `process_exoplanets` → `build_star_identity` → `build_distance_corrections` → `build_added_hosts` → `process_stars` → `process_star_search` → `process_binaries` → `build_planet_scene`. `process_stars.js` aplica las correcciones de distancia y añade las anfitrionas si esos dos archivos existen; AT-HYG no se modifica.

Cada carpeta de `data/raw/` incluye un `FUENTE.md` o `FUENTES.md` con la URL, la fecha de descarga y la cita de cada archivo. Algunos datos crudos voluminosos no se versionan y se descargan con las URL indicadas ahí.

Las fuentes de lunas y anillos (`data/moons/fuentes/`, `data/rings/fuentes/`) no se versionan: incluyen texto de Wikipedia con otra licencia y descargas voluminosas de Horizons y del PDS; sus URL están en los generadores. Las lunas (≈ 0,25 MB comprimido) y los anillos (≈ 40 kB) se cargan aparte.

El catálogo (≈ 4,6 MB comprimido), los sistemas múltiples (≈ 0,3 MB) y los planetas (≈ 0,3 MB) se cargan aparte del bloque inicial de la aplicación, de modo que el sistema solar y la interfaz aparecen antes que las estrellas. El mapa de descubrimientos (≈ 0,2 MB comprimido) solo se pide al abrir el modo «Exoplanetas».

## 13. Pruebas

`npm test` ejecuta las pruebas de `scripts/*.test.js` con el ejecutor nativo de Node. Cubren funciones puras y simulaciones de cámara: escalas, viajes, límites, marco galáctico, búsqueda, órbitas, exoplanetas y parches del catálogo. Las posiciones de los planetas se comparan con vectores de JPL Horizons. Las órbitas de binarias se validan contra las efemérides del propio ORB6: el ángulo de posición y la separación de Sirio, Procyon y Alfa Centauri para 2026 coinciden dentro de 0,06° y 0,01″. No hay pruebas automáticas de navegador ni de shaders.

## 14. Lo que Hoshi no es

- No es un planetario: los planetas del sistema solar están en su posición del día en que se abre la página, pero no se puede elegir otra fecha ni verlos avanzar; binarias y exoplanetas se evalúan en una fecha fija.
- Las órbitas de exoplanetas no están completas en 3D: el giro del plano en el cielo es convencional, y su aspecto no es conocido.
- No es un censo estelar: el catálogo es una muestra, más completa cerca del Sol.
- No simula relatividad, tiempo de viaje de la luz ni fotometría observacional.
- Las nubes de partículas (Kuiper, Oort, galaxia) y los halos son recursos ilustrativos.

## 15. Referencias

- AT-HYG / HYG Database, D. Nash.
- JPL Solar System Dynamics: parámetros astronómicos, elementos orbitales aproximados y parámetros físicos de los planetas.
- JPL Horizons (https://ssd.jpl.nasa.gov/horizons/): trayectorias de Voyager 1 y 2 y Pioneer 10 y 11.
- Ballesteros, F. J. (2012), EPL 97, 34008: temperatura a partir de B−V.
- Flower, P. J. (1996), ApJ 469, 355; Torres, G. (2010), AJ 140, 1158: corrección bolométrica.
- Ribas, I. et al. (2017), A&A 603, A58: Próxima Centauri.
- Hartkopf, Mason y Worley, Sixth Catalog of Orbits of Visual Binary Stars, USNO.
- Mason et al., Washington Double Star Catalog, USNO.
- Tokovinin, A. (2018), ApJS 235, 6: Multiple Star Catalog.
- Pourbaix, D. et al. (2004), A&A 424, 727: SB9.
- Bond, H. E. et al. (2017), ApJ 840, 70: Sirio. Bond, H. E. et al. (2015), ApJ 813, 106: Procyon.
- Thomas, J. D. et al. (2021), MNRAS 504, 5221: WR 140.
- Manchester et al. (2005), AJ 129, 1993: catálogo de púlsares ATNF.
- NASA Exoplanet Archive, tabla Planetary Systems Composite Parameters (`pscomppars`).
- Gaia Collaboration (2023), A&A 674, A1: Gaia DR3. Riello, M. et al. (2021), A&A 649, A3: fotometría de Gaia.
- CDS XMatch y SIMBAD, CDS, Estrasburgo.
- ESA/Gaia/DPAC, Stefan Payne-Wardenaar: imagen de la Vía Láctea, CC BY-SA 3.0 IGO.
