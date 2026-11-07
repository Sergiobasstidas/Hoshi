# Fuentes de `data/raw/cns5`

Fifth Catalogue of Nearby Stars (CNS5; Golovin et al. 2023, A&A 670, A19, bibcode 2023A&A...670A..19G), versión publicada. Descarga hecha con `python3 scripts/catalog/descargar_cercanas.py cns5` desde el Mac de Sergio el 07/11/2026 a las 14:06 (zona -03:00). Datos tal como los entrega el servicio.

- Servicio: TAP de GAVO Data Center (Heidelberg), `https://dc.zah.uni-heidelberg.de/tap`, `SELECT * FROM cns5.main`. Se comprobó el total con `SELECT COUNT(*) FROM cns5.main`. GAVO tiene además `cns5update.main` (6 521 filas, actualizada de forma continua), que no se usa.
- Licencia: CC BY 4.0 (según GAVO).

| Archivo | Bytes | Filas de datos | sha256 |
| --- | ---: | ---: | --- |
| `cns5_main.csv` | 3070475 | 5909 | `9aafd6307bdcb83a89e23f4e42445dbbb0a36b9d4fcd51334f315ee5f8ee1024` |

5 908 filas traen paralaje trigonométrica (`parallax_bibcode`: Gaia EDR3 en 5 139, Hipparcos 2007 en 192 y el resto de Spitzer y telescopios en tierra). Uso: `scripts/catalog/build_hsb.js`.
