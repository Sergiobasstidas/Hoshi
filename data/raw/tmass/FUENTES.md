# Fuentes de `data/raw/tmass`

Vecino más probable en 2MASS (PSC/XSC) de cada fuente Gaia DR3, según la tabla de cruce oficial de Gaia DR3 `gaiadr3.tmass_psc_xsc_best_neighbour`. Descarga hecha con `python3 scripts/catalog/descargar_cercanas.py tmass` desde el Mac de Sergio el 07/11/2026, entre las 14:09 y las 14:26 (zona -03:00).

- Servicio: TAP de ARI (Heidelberg), `https://gaia.ari.uni-heidelberg.de/tap`, consulta síncrona con los identificadores subidos (`TAP_UPLOAD`) en 12 lotes de hasta 100 000.
- Identificadores pedidos: 1 186 958 Gaia DR3 (los del registro HSB al 07/11, los de CNS5 y los de `data/raw/gaia/gaia_dr3_1m.csv.gz`). Devueltos con vecino 2MASS: 1 176 955.
- Columnas: `source_id, tmass, angular_distance, number_of_neighbours, number_of_mates, xm_flag` (`tmass` = `original_ext_source_id`, la designación 2MASS sin el prefijo «2MASS J»). Filas ordenadas por `source_id`, comprimidas con gzip (mtime 0).
- Licencia: datos de Gaia (ESA/Gaia/DPAC), CC BY-SA 3.0 IGO; 2MASS (UMass/IPAC-Caltech, NASA/NSF), de uso libre con agradecimiento.

| Archivo | Bytes | Filas de datos | sha256 |
| --- | ---: | ---: | --- |
| `gaia_dr3_tmass.csv.gz` | 24959036 | 1176955 | `efc0653fa709220702198f3f4223daf6bc827a8c7b4f0e3ac7c5bd6886cbf976` |

Uso: columna `tmass` del registro HSB y de los lotes de `data/catalog/hsb_gaia/`.
