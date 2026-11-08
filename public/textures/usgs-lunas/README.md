# Mapas de las lunas grandes de Júpiter y Saturno

Mosaicos globales de USGS Astrogeology (datos de Galileo, Voyager y Cassini) y el mapa de Mimas de NASA/JPL/Space Science Institute. Material del gobierno de EE. UU., de dominio público. Descargados el 08/11/2026.

Cambios: reducidos a 2048 × 1024, en gris, JPEG calidad 85, con `sips`. Todos quedan con la longitud 0 en el centro y el este hacia la derecha, como los mapas de planetas de Hoshi. Los de Europa, Ganímedes y Calisto vienen centrados en 180°: se desplazaron media vuelta. Al de Mimas se le recortó el marco con la escala y las coordenadas: queda solo el mapa, de 5760 × 2880. El centro de cada mapa se tomó de sus metadatos GeoTIFF (meridiano central) y se comprobó con Valhalla en Calisto (56° O) y Herschel en Mimas (112° O). Las zonas sin datos de los polos quedan en negro, como en el original.

Hoshi orienta cada luna con su polo y su meridiano cero de la IAU (WGCCRE 2015): la longitud 0 mira al planeta. Los mapas se tiñen con el color de cada luna; el gris es el del mosaico. Titán no lleva mapa, porque en luz visible se ve su neblina y no la superficie.

| Archivo | Luna | Original | Resolución original |
| --- | --- | --- | --- |
| io.jpg | Ío | https://planetarymaps.usgs.gov/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif | 1 km/píxel |
| europa.jpg | Europa | https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif | 500 m/píxel |
| ganimedes.jpg | Ganímedes | https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif | 1 km/píxel |
| calisto.jpg | Calisto | https://planetarymaps.usgs.gov/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif | 1 km/píxel |
| mimas.jpg | Mimas | https://photojournal.jpl.nasa.gov/catalog/PIA12780 (NASA/JPL/Space Science Institute, «Map of Mimas - February 2010») | 216 m/píxel |
| encelado.jpg | Encélado | https://planetarymaps.usgs.gov/mosaic/Enceladus_Cassini_mosaic_global_110m.tif | 110 m/píxel |
| tetis.jpg | Tetis | https://planetarymaps.usgs.gov/mosaic/Tethys_Cassini_mosaic_global_293m.tif | 293 m/píxel |
| dione.jpg | Dione | https://planetarymaps.usgs.gov/mosaic/Dione_Cassini_Voyager_mosaic_global_154m.tif | 154 m/píxel |
| rea.jpg | Rea | https://planetarymaps.usgs.gov/mosaic/Rhea_Cassini_Voyager_mosaic_global_417m.tif | 417 m/píxel |
| japeto.jpg | Jápeto | https://planetarymaps.usgs.gov/mosaic/Iapetus_Cassini_Voyager_mosaic_global_783m.tif | 783 m/píxel |

Fichas de USGS: https://astrogeology.usgs.gov/search (buscar el nombre del archivo). Los mosaicos de Saturno son de Roatsch, Kersten y colaboradores (DLR y CICLOPS).

SHA-256:

```
659fadb560e71056e27370000b268bfcf6c6b2f7b08ca5817f8b682e101f4ad6  io.jpg
c3392fe1c6f1dd678251e2eb75c92d08616efa7821f27740acf6bc7dbeec3eab  europa.jpg
dd3993ad54215101dba5f9e3bf0b2b0562c39508f95f51597d5dff8f08bcc1a1  ganimedes.jpg
13e39dbf92d19e137ae46f845487913e5fe696844d8234cc6d4d10aa332394a5  calisto.jpg
2ebbeba45ca830a22fecb4ecfb3ca0f473c1e07c447efb7e570f35426e283c86  mimas.jpg
e3e9815ba710182781cd2ab01524a4a9647584d2679eef1ddc112f09c8feb6fd  encelado.jpg
85d27009218be108b78bfe3dd8dc7fab83fce532452aea22d08117eab628c2c5  tetis.jpg
7ac4d58aae39b930a72f90f9d7d7e773dacd637104022ad5811eef6d18b89a87  dione.jpg
a29758fa250512170e3f2ce1c38a4b66729a974897a2820118364bea4b9cf5e0  rea.jpg
c3b7826f850ccfb3f3fe29a92f0a4a2e809ebfef3a1e0a3f4580a3eaf9493d57  japeto.jpg
```
