# Imágenes recientes del Sol (SDO)

Autor: NASA Solar Dynamics Observatory. Crédito solicitado: «Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams».
Fuente: https://sdo.gsfc.nasa.gov/data/ (imágenes «latest», 2048 × 2048). Política de uso: https://sdo.gsfc.nasa.gov/data/rules.php

Se descargan con `node scripts/sdo/descargar_sdo.mjs`, que se niega a repetir la descarga antes de 15 minutos (el SDO pide no pedir las «latest» con más frecuencia). `sdo.json` guarda la URL, la fecha (cabecera `Last-Modified` del servidor), el tamaño y el SHA-256 de cada imagen.

| Archivo | Instrumento | Capa |
| --- | --- | --- |
| 0171.jpg | AIA 171 Å | corona tranquila y arcos (≈ 600 000 K) |
| 0193.jpg | AIA 193 Å | corona y agujeros coronales (≈ 1,2 MK) |
| 0304.jpg | AIA 304 Å | cromosfera y región de transición (≈ 50 000 K) |
| HMIB.jpg | HMI | magnetograma: blanco y negro, polaridades opuestas |
| HMII.jpg | HMI | luz visible (intensitygram), con oscurecimiento del borde |

Imágenes sin modificar. Solo muestran la cara del Sol que mira a la Tierra.
