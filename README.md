# Hoshi

© 2026 Sergio Bastidas Acosta. [Autoría y derechos](AUTORIA.md).

Exploración 3D del sistema solar, el vecindario estelar y nuestro lugar en la Vía Láctea. Su propósito es hacer comprensibles las distancias y escalas astronómicas.

## Ejecutar

Node 22.12 o posterior. `npm ci`, luego `npm run dev`.

Validación: `npm test`, `npm run lint`, `npm run build`. Vista de producción: `npm run preview`.

## Qué incluye

- Catálogo AT-HYG/HYGLike: 118.660 registros locales más objetos curados; posiciones en parsecs, marco ecuatorial J2000 y origen solar.
- Sol, ocho planetas y Luna con radios físicos; órbitas circulares con inclinaciones individuales. Texturas de Sol, Mercurio, Venus, Tierra y Luna.
- Kuiper, heliosfera y Oort ilustrativos; Voyager con trayectorias todavía esquemáticas.
- Búsqueda por nombres y varios identificadores, navegación con origen local, vuelo libre y visitas suaves. WR 140 como binario y Eta Carinae como registro curado.
- Mapa activable de 14 púlsares y capa galáctica ESA/Gaia: imagen más partículas con espesor, centro galáctico y marcador solar. Exploración hasta 200.000 años luz.

Las partículas galácticas y los halos son ayudas visuales, no estrellas medidas ni radios físicos. La galaxia es una reconstrucción ilustrativa. Los 362 radios fotométricos son estimaciones; no equivalen a mediciones publicadas. Próxima tiene un valor publicado incorporado.

## Controles

En vuelo libre: W/S avanzar/retroceder, A/D lateral, R/F vertical, Q/E giro y flechas para mirar. Arrastrar con el ratón orienta; la rueda cambia **velocidad**, no distancia. Doble clic en una etiqueta fija rumbo sin viajar. Buscador y selector viajan al destino. «Volver al Sol» orienta sin trasladar.

## Documentación

- [Estado y decisiones vigentes](HOSHI_CONTEXT.md)
- [Handoff actual](HOSHI_HANDOFF.md)
- [Trabajo pendiente, ordenado](PENDIENTES.md)
- [Índice de documentación y fuentes](docs/README.md)
- [Despliegue en Cloudflare](docs/DEPLOYMENT.md)
- [Vía Láctea](docs/MILKY_WAY_PLAN.md)

## Historial y publicación

Repositorio: https://github.com/Sergiobasstidas/Hoshi . El historial Git comienza con una instantánea del desarrollo existente; no se han fabricado commits de fechas pasadas. Los siguientes cambios se registran por tandas verificables. `docs/milestones.json` conserva hitos retrospectivos estructurados para convertirlos en registros de GitHub cuando haya acceso autenticado; no representan commits históricos.

Cloudflare Pages publica el sitio; GitHub almacena el código y ejecuta las comprobaciones. Configuración: rama `main`, `npm run build`, carpeta `dist`, Node 22. No necesita secretos para funcionar en el navegador.

## Créditos

ESA/Gaia/DPAC, Stefan Payne-Wardenaar: imagen galáctica CC BY-SA 3.0 IGO y adaptación con partículas; [atribución](public/textures/galaxy/ATTRIBUTION.md). Solar System Scope / INOVE: mapas CC BY 4.0; [detalles](public/textures/solar-system-scope/README.md). Ruido Ashima Arts: [licencia MIT](public/licenses/webgl-noise.txt). Catálogos y parámetros conservan las fuentes indicadas en los documentos específicos. Las licencias de recursos de terceros no conceden una licencia general al código de Hoshi.
