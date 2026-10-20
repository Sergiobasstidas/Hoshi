# Mapa completo del Sol en 304 Å

Autor: NASA/Goddard Space Flight Center Scientific Visualization Studio.
Fuente: «STEREO+SDO: Around the Sun for 81 Days», https://svs.gsfc.nasa.gov/3851
Datos: STEREO-A y STEREO-B (EUVI) y Solar Dynamics Observatory (AIA), 1 de abril a 20 de junio de 2011.
Crédito solicitado para las imágenes del SDO: Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams.
Condiciones: material de la NASA sin derechos de autor salvo indicación; https://www.nasa.gov/nasa-brand-center/images-and-media/
Aviso de la fuente: secuencia apta para visualización, no para análisis científico.

Proyección cilíndrica equidistante en coordenadas de Carrington. Descargados el 13/10/2026.

| Archivo | Dimensiones | Origen |
| --- | --- | --- |
| sol-304-2011.jpg | 4096 × 2048 | Sin modificar: https://svs.gsfc.nasa.gov/vis/a000000/a003800/a003851/solarSphere304A.0200.jpg |
| sol-304-2011-lento.mp4 | 1792 × 896, 20 fps, 162 s | Adaptado de https://svs.gsfc.nasa.gov/vis/a000000/a003800/a003851/solarMap_Summer2011_2048.mov |

Adaptación del vídeo: reproducción ocho veces más lenta, con fotogramas intermedios obtenidos por mezcla de los originales (uno cada ≈ 3 horas), reducción de tamaño y compresión H.264. Los fotogramas intermedios no son observaciones.

```
ffmpeg -i solarMap_Summer2011_2048.mov -an -vf "setpts=8*PTS,minterpolate=fps=20:mi_mode=blend,scale=1792:896:flags=lanczos" -c:v libx264 -preset slow -crf 32 -maxrate 950k -bufsize 6M -pix_fmt yuv420p -movflags +faststart sol-304-2011-lento.mp4
```

SHA-256:

```
043432479e929a1cfd056b7d9f883d6dfbdb2569286d06838b0ca56bb21524c8  sol-304-2011-lento.mp4
c3a2cd626d445b19312c9a92840093b5b64c8da97884c2d00b39162dd2048bb2  sol-304-2011.jpg
```
