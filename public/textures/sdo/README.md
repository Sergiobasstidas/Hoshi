# Imágenes recientes del Sol (SDO)

Autor: NASA Solar Dynamics Observatory. Crédito solicitado: «Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams».
Fuente: https://sdo.gsfc.nasa.gov/data/ (imágenes «latest», 2048 × 2048, y vídeo de las últimas 48 h). Política de uso: https://sdo.gsfc.nasa.gov/data/rules.php

Se descargan con `node scripts/sdo/descargar_sdo.mjs`, que se niega a repetir la descarga antes de 15 minutos (el SDO pide no pedir las «latest» con más frecuencia). `sdo.json` guarda la URL, la fecha (cabecera `Last-Modified` del servidor), el tamaño y el SHA-256 de cada archivo.

| Archivo | Instrumento | Capa |
| --- | --- | --- |
| 0131.jpg, 0131.mp4 | AIA 131 Å | corona muy caliente y fulguraciones (≈ 10 MK) |
| 0171.jpg | AIA 171 Å | corona tranquila y arcos (≈ 600 000 K) |
| 0193.jpg | AIA 193 Å | corona y agujeros coronales (≈ 1,2 MK) |
| 0211.jpg | AIA 211 Å | corona de regiones activas (≈ 2 MK); solo para la composición 304/211/171 |
| 0304.jpg | AIA 304 Å | cromosfera y región de transición (≈ 50 000 K) |
| 211193171.jpg | AIA | composición del SDO: 211 Å en rojo, 193 Å en verde, 171 Å en azul |
| HMIB.jpg | HMI | magnetograma: blanco y negro, polaridades opuestas |
| HMIIF.jpg | HMI | luz visible aplanada (sin oscurecimiento del borde) |

Imágenes sin modificar. `0131.mp4` es una copia reducida de `latest_1024_0131.mp4` (768 px, H.264, sin audio, CRF 30); el original pesa ≈ 70 MB y el servidor no permite usarlo desde otra web. La composición 304/211/171 (304 Å en rojo, 211 Å en verde, 171 Å en azul) no se publica en imagen fija: la arma `src/scene/sdoSolar.js` con el brillo de cada canal.

Solo muestran la cara del Sol que mira a la Tierra; en la aplicación, la cara oculta es su reflejo.
