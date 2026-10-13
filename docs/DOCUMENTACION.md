# Hoshi — documentación técnica

Cómo está construido Hoshi y cómo calcula lo que muestra. Los valores citados salen del código; cada apartado indica el archivo donde viven. Resumen general, ejecución y créditos en el [README](../README.md).

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

Archivos: `scale.js`, `solarBodies.js`, `SolarSystem.jsx`.

- Sol, ocho planetas y Luna con **radios volumétricos medios** (NASA/JPL) a escala real.
- Órbitas **circulares** con el semieje medio de cada planeta, e inclinación i y longitud del nodo ascendente Ω reales (JPL, J2000). Para un ángulo θ en la órbita de radio r:

```
x' = r · cos θ            y' = r · sen θ
x_ecl = cos Ω · x' − sen Ω · cos i · y'
y_ecl = sen Ω · x' + cos Ω · cos i · y'
z_ecl = sen i · y'
```

seguido del giro eclíptica → ecuatorial del apartado 4.

- **Límites:** sin excentricidad y sin efemérides; la posición de cada planeta en su órbita es ilustrativa, no la de una fecha. La Luna está a su separación media (384.400 km). Texturas de Solar System Scope para Sol, Mercurio, Venus, Tierra y Luna; su orientación es ilustrativa.

Capas del entorno solar, todas **ilustrativas** salvo sus distancias:

| Capa | Distancias | Representación |
| --- | --- | --- |
| Cinturón de Kuiper | 30–50 UA | 22.000 puntos sintéticos |
| Heliosfera | ≈ 120 UA | Superficie translúcida estática |
| Voyager 1 y 2 | 172 y 143 UA | Líneas esquemáticas desde el Sol |
| Nube de Oort | 2.000–100.000 UA | 140.000 partículas sintéticas |

## 7. Estrellas

### Catálogo

Fuente: AT-HYG v3.2 (compilación de Hipparcos, Gaia y otros catálogos). `scripts/process_stars.js` produce `data/processed/stars_15pc.json` con 118.660 estrellas (el nombre del archivo es heredado: no se limita a 15 pc). Campos: identificador, nombre, x, y, z, distancia, magnitud absoluta, índice de color B−V, tipo espectral y color RGB.

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

Al acercarse a una estrella que en realidad es un sistema, sus compañeras se separan del punto del catálogo. El índice tiene 5.615 sistemas y 6.848 componentes.

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

## 9. Vía Láctea y púlsares

**Galaxia** (`galaxy.js`, `MilkyWay.jsx`). Es una **reconstrucción ilustrativa**, no un catálogo 3D medido. Parte de la imagen frontal de la Vía Láctea de ESA/Gaia/DPAC (Stefan Payne-Wardenaar): hasta 55.000 partículas se muestrean por rechazo sobre el brillo de la imagen y reciben espesor con una distribución gaussiana, mayor en el bulbo. La imagen abarca 40.610 pc de lado, registrada para que el vecindario solar caiga a 8.122 pc del centro. Aparece entre 1.800 y 7.000 años luz del Sol.

**Púlsares** (`pulsarData.js`, `PulsarMap.jsx`). Los 14 púlsares del mapa de las placas Pioneer y Voyager, con coordenadas y distancias del catálogo ATNF. Las líneas unen el Sol con cada púlsar; los trazos discontinuos son decorativos y no codifican períodos.

## 10. Navegación

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

### Vuelo libre

Archivos: `FreeFlight.jsx`, `flightMotion.js`, `controlVelocidad.js`. La rueda y el dial eligen la **velocidad**, no la posición. El dial es logarítmico entre 10⁻¹⁴ pc/s y 15.000 años luz/s:

```
v = v_mín · (v_máx / v_mín)^(valor / 100)
```

Las velocidades son de navegación: superan la de la luz sin pretender realismo físico. Cerca de una estrella con rumbo fijado hay frenado automático: se detiene a 1,15 radios si el radio es conocido y a 0,001 UA si no.

### Límites

El vuelo libre no supera 200.000 años luz del Sol, y la órbita de cámara no supera esa distancia respecto de su objetivo. Los viajes automáticos no recortan destinos: unas pocas estrellas del catálogo quedan más allá y se puede llegar a ellas.

## 11. Datos y generadores

Los generadores se ejecutan a mano desde la raíz; no forman parte del build.

| Comando | Entrada | Salida |
| --- | --- | --- |
| `node scripts/process_stars.js` | `data/raw/hyglike_from_athyg_v32.csv` | `data/processed/stars_15pc.json` |
| `node scripts/process_stellar_physics.js` | El mismo CSV | `data/processed/stellar_physics.json` |
| `node scripts/process_star_search.js` | CSV y catálogo procesado | `public/data/star-search.json` |
| `node scripts/process_binaries.js` | `data/raw/multiplicity/` | `data/processed/star_systems.json` |

Cada carpeta de `data/raw/` incluye un `FUENTE.md` o `FUENTES.md` con la URL, la fecha de descarga y la cita de cada archivo. Algunos datos crudos voluminosos no se versionan y se descargan con las URL indicadas ahí.

El catálogo (≈ 4,4 MB comprimido) y los sistemas múltiples (≈ 0,3 MB) se cargan aparte del bloque inicial de la aplicación, de modo que el sistema solar y la interfaz aparecen antes que las estrellas.

## 12. Pruebas

`npm test` ejecuta las pruebas de `scripts/*.test.js` con el ejecutor nativo de Node. Cubren funciones puras y simulaciones de cámara: escalas, viajes, límites, marco galáctico, búsqueda y órbitas. Las órbitas de binarias se validan contra las efemérides del propio ORB6: el ángulo de posición y la separación de Sirio, Procyon y Alfa Centauri para 2026 coinciden dentro de 0,06° y 0,01″. No hay pruebas automáticas de navegador ni de shaders.

## 13. Lo que Hoshi no es

- No es un planetario con efemérides: las posiciones de planetas y la fecha de las órbitas son fijas.
- No es un censo estelar: el catálogo es una muestra, más completa cerca del Sol.
- No simula relatividad, tiempo de viaje de la luz ni fotometría observacional.
- Las nubes de partículas (Kuiper, Oort, galaxia) y los halos son recursos ilustrativos.

## 14. Referencias

- AT-HYG / HYG Database, D. Nash.
- JPL Solar System Dynamics: parámetros astronómicos, elementos orbitales aproximados y parámetros físicos de los planetas.
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
- ESA/Gaia/DPAC, Stefan Payne-Wardenaar: imagen de la Vía Láctea, CC BY-SA 3.0 IGO.
