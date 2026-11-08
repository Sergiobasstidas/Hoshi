# Fuentes de `data/raw/hipparcos`

Hipparcos, nueva reducción (van Leeuwen 2007, A&A 474, 653; VizieR I/311). Descarga con `python3 scripts/catalog/descargar_cercanas.py hipparcos` desde el Mac de Sergio el 07/11/2026 a las 20:57 (zona -03:00), tabla completa `hipparcos` del TAP de ARI (Heidelberg). Se comprobó el total con `SELECT COUNT(*) FROM hipparcos`. Columnas: `hip, ra, dec, plx, e_plx, pmra, pmdec, hpmag, b_v, e_b_v, v_i, nc, sn` (posiciones en época 1991,25), ordenadas por `hip`, gzip con mtime 0. Datos de ESA, de uso libre con cita.

| Archivo | Bytes | Filas de datos | sha256 |
| --- | ---: | ---: | --- |
| `hipparcos_2007.csv.gz` | 4706951 | 117955 | `5761509ff8d8d49c1b39d34877123bd61c8367d8cc9689fd923d4c0a364f5066` |

Uso: distancia de las estrellas que Gaia no mide bien (`scripts/catalog/fusion.js`), con error de paralaje de hasta 10 %.
