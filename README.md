# Hoshi

© 2026 Sergio Bastidas Acosta. [Autoría y derechos](AUTORIA.md).

Exploración 3D del sistema solar, el vecindario estelar y nuestro lugar en la Vía Láctea. Su propósito es hacer comprensibles las distancias y escalas astronómicas recorriéndolas de forma continua, desde la Tierra hasta 200.000 años luz.

Sitio: [hoshi-map.pages.dev](https://hoshi-map.pages.dev/). Cómo se calcula todo: [documentación técnica](docs/DOCUMENTACION.md). Avance del proyecto: [historial](docs/HISTORIAL.md).

## Qué incluye

- **Sistema solar:** Sol, ocho planetas y Luna con radios a escala real, órbitas con su inclinación, cinturón de Kuiper, heliosfera, Voyager 1 y 2 y Pioneer 10 y 11 en su posición real del día (JPL Horizons) y nube de Oort.
- **Estrellas:** 122.284 estrellas en sus posiciones medidas, con color por temperatura: 118.660 del catálogo AT-HYG, el 99,5 % enlazadas con Gaia DR3, y 3.624 anfitrionas de exoplanetas añadidas.
- **Sistemas planetarios:** 6.125 exoplanetas de 4.533 sistemas, con órbitas y radios a escala. La ficha indica qué valores son medidos y cuáles supuestos. Se puede viajar a cada planeta.
- **Mapa de exoplanetas:** el botón «Exoplanetas» atenúa estrellas y galaxia y marca los 12.134 sistemas con planetas confirmados o candidatos del NASA Exoplanet Archive, con filtros por estado, tipo de planeta y misión.
- **Sistemas múltiples:** 5.786 sistemas que se separan en sus componentes al acercarse, con órbitas publicadas y, cuando hay masas, las dos estrellas girando en torno a su centro común.
- **Vía Láctea:** reconstrucción con volumen a partir de la imagen de ESA/Gaia, centro galáctico y posición del Sol.
- **Mapa de púlsares:** los 14 púlsares de las placas Pioneer y Voyager.
- **Navegación:** buscador por nombre e identificadores, escala lateral, viajes suaves entre escalas y vuelo libre.

Hoshi separa lo medido de lo ilustrativo. Posiciones, distancias, radios y órbitas publicadas están a escala. Halos, marcadores, nubes de partículas y texturas son ayudas visuales, y la interfaz lo indica.

## Tecnologías

React 19, Three.js con React Three Fiber y Drei, Vite 8, JavaScript con módulos ES. Sitio estático sin backend, alojado en Cloudflare Pages. Los catálogos se procesan con scripts de Node y se sirven como archivos estáticos.

## Ejecutar

Requiere Node 22.12 o posterior.

```sh
npm ci
npm run dev
```

Comprobaciones: `npm test`, `npm run lint`, `npm run build`. Vista del build: `npm run preview`.

## Controles

- **Buscador y selector:** viajan al destino.
- **Escala lateral:** muestra la distancia y viaja al hacer clic.
- **Doble clic en el nombre de una estrella:** fija el rumbo sin viajar.
- **Vuelo libre:** W/S avanzar y retroceder, A/D lateral, R/F vertical, Q/E inclinar, flechas o arrastre para mirar. La rueda y el dial cambian la velocidad.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `src/` | Aplicación: interfaz, escena 3D y funciones de cálculo |
| `data/raw/` | Catálogos originales con su procedencia |
| `data/processed/` | Datos que carga la aplicación |
| `scripts/` | Generadores de datos y pruebas |
| `public/` | Texturas, índice de búsqueda y licencias |
| `docs/DOCUMENTACION.md` | Unidades, coordenadas, fórmulas, fuentes y límites |
| `docs/HISTORIAL.md` | Avance del proyecto por fechas |

## Créditos

- **Catálogo estelar:** AT-HYG / HYG Database.
- **Sistemas múltiples:** Sixth Catalog of Orbits of Visual Binary Stars y Washington Double Star Catalog (U.S. Naval Observatory), Multiple Star Catalog (A. Tokovinin), SB9 (Pourbaix et al.).
- **Sistema solar y sondas:** NASA / JPL Solar System Dynamics y JPL Horizons.
- **Púlsares:** catálogo ATNF.
- **Imagen galáctica:** ESA/Gaia/DPAC, Stefan Payne-Wardenaar, CC BY-SA 3.0 IGO; [atribución](public/textures/galaxy/ATTRIBUTION.md).
- **Texturas:** Solar System Scope / INOVE, CC BY 4.0; [detalles](public/textures/solar-system-scope/README.md).
- **Ruido procedural:** Ashima Arts, [licencia MIT](public/licenses/webgl-noise.txt).

Las referencias completas están en la [documentación técnica](docs/DOCUMENTACION.md) y en los archivos de fuentes de `data/raw/`. Las licencias de recursos de terceros no conceden una licencia general sobre el código de Hoshi.
