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
- Mapa activable de 14 púlsares y capa galáctica ESA/Gaia: imagen más partículas con espesor, centro galáctico y marcador solar. Escalas de navegación hasta 200.000 años luz; excepciones de límites documentadas en el estado actual.

Las partículas galácticas y los halos son ayudas visuales, no estrellas medidas ni radios físicos. La galaxia es una reconstrucción ilustrativa. Los 362 radios fotométricos son estimaciones; no equivalen a mediciones publicadas. Próxima tiene un valor publicado incorporado.

## Controles

En vuelo libre: W/S avanzar/retroceder, A/D lateral, R/F vertical, Q/E giro y flechas para mirar. Arrastrar con el ratón orienta; la rueda y el dial cambian **velocidad**. La escala derecha previsualiza y viaja por clic/teclado en 2 s. Doble clic en una etiqueta fija rumbo sin viajar. Buscador y selector viajan al destino. «Volver al Sol» orienta sin trasladar.

## Historial y publicación

Remoto configurado: [Sergiobasstidas/Hoshi](https://github.com/Sergiobasstidas/Hoshi). Git registra historial; GitHub puede ir por detrás de la carpeta local. No hacer commit, push o deployment sin autorización aplicable de Sergio. La integración Cloudflare comunicada por el usuario puede publicar al subir; su estado remoto no se comprobó en esta auditoría.

El historial Git comienza con una instantánea del desarrollo existente. `docs/milestones.json` conserva hitos retrospectivos, no commits históricos inventados. Build local: `npm run build`, salida `dist`. Ver configuración/evidencia en `docs/DEPLOYMENT.md`.

## Créditos

ESA/Gaia/DPAC, Stefan Payne-Wardenaar: imagen galáctica CC BY-SA 3.0 IGO y adaptación con partículas; [atribución](public/textures/galaxy/ATTRIBUTION.md). Solar System Scope / INOVE: mapas CC BY 4.0; [detalles](public/textures/solar-system-scope/README.md). Ruido Ashima Arts: [licencia MIT](public/licenses/webgl-noise.txt). Catálogos y parámetros conservan las fuentes indicadas en los documentos específicos. Las licencias de recursos de terceros no conceden una licencia general al código de Hoshi.
