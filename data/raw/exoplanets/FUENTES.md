# Fuentes de `data/raw/exoplanets`

Descarga realizada con `curl -sSL` desde el Mac de Sergio el 13/10/2026 (zona -03:00). Datos crudos sin modificar.

| Archivo | Descarga (hora local, -03:00) | Tamaño (bytes) | Líneas | Columnas | sha256 |
| --- | --- | ---: | ---: | ---: | --- |
| `nasa_pscomppars.csv` | 2026-10-13 01:10 | 82851596 | 6446 | 703 | `884d7042436e16cb1c99459afb9d08ac351e09324f571dee1388d9691c3a7ca6` |
| `nasa_stellarhosts.csv` | 2026-10-13 01:10 | 53577533 | 48087 | 136 | `0f69d014e6f416320874482a6e6cdf50d8bd3897ddb960b375b7d966ea521bc4` |
| `nasa_pscomppars_ids.csv` | 2026-10-13 01:10 | 721517 | 6446 | 10 | `b74b02034c7c63da3567802d455909d749ee5d339b6d1f915c8a5cf6482871b4` |
| `exoplaneteu_catalog.csv` | 2026-10-13 01:24–01:40 | 3689586 | 8355 | 98 | `14600283a5b5deded2c0c574f23b9e4109e74f0e8ec5cb7f7590a7bf5b172dc4` |

Las líneas incluyen la cabecera.

## URLs exactas

- `nasa_pscomppars.csv` — NASA Exoplanet Archive, tabla compuesta de parámetros planetarios:
  `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+*+from+pscomppars&format=csv`
- `nasa_stellarhosts.csv` — NASA Exoplanet Archive, anfitriones estelares:
  `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+*+from+stellarhosts&format=csv`
- `nasa_pscomppars_ids.csv` — NASA Exoplanet Archive, identificadores y multiplicidad:
  `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+pl_name,hostname,hd_name,hip_name,tic_id,gaia_dr2_id,gaia_dr3_id,sy_snum,sy_pnum,cb_flag+from+pscomppars&format=csv`
- `exoplaneteu_catalog.csv` — Enciclopedia de los Planetas Extrasolares (exoplanet.eu):
  `https://exoplanet.eu/catalog/csv/`

## Incidencias

- Las tres consultas a la NASA respondieron HTTP 200 al primer intento.
- exoplanet.eu entrega el CSV en streaming a unos 3–4 kB/s. Dos intentos se cortaron por límite de tiempo de curl (300 s y 570 s) y dejaron archivos truncados, ya eliminados. El tercero, con límite de 3000 s, terminó con código 0 y HTTP 200; los truncados coincidían byte a byte con el inicio del archivo final.
- Algunas celdas de `nasa_pscomppars.csv` contienen HTML de referencia (`<a refstr=...>`); es contenido propio de la tabla, no un error.
- Esta carpeta no está ignorada por git y pesa unos 137 MB.

## Candidatos y tipos de planeta (modo de descubrimientos)

Descarga con `curl -sS` desde el Mac de Sergio el 14/10/2026 entre 01:25 y 01:45 (-03:00). Datos crudos sin modificar; los usa `scripts/exoplanets/build_discoveries.js`.

| Archivo | Tamaño (bytes) | Líneas | sha256 |
| --- | ---: | ---: | --- |
| `nasa_toi.csv` | 1062838 | 8149 | `ad50648ca5652247fd69ba121037bc0d1cc7bf9cab94c7113ed657ffc6ff02e8` |
| `nasa_koi_cumulative.csv` | 1009457 | 9565 | `8a38a88df123209385b891f8a7016948b25a19dff53c9909130a206d9de05110` |
| `nasa_keplerstellar_koi.csv` | 200258 | 3711 | `2e5993cd131da85eec9e9bc982ebfdcdd3273dd676a86a0f64def56c9b145379` |
| `nasa_k2pandc.csv` | 513356 | 4078 | `ce72e92cd6d7f19e06b374f81a92bc34f03b3302601439d74891289724844117` |
| `nasa_science_catalog_types.csv` | 609464 | 6446 | `30feebed28b5833dd2236c4ca0f7bbcad758dfcff6e59a6dab26fa363266aeff` |

Consultas (TAP del NASA Exoplanet Archive, `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=csv&query=…`):

- `nasa_toi.csv`: `select tid,toi,toipfx,tfopwg_disp,ra,dec,pl_rade,pl_orbper,st_dist,st_teff,st_rad,rowupdate from toi`
- `nasa_koi_cumulative.csv`: `select kepid,kepoi_name,kepler_name,ra,dec,koi_disposition,koi_pdisposition,koi_prad,koi_period,koi_score,koi_steff from cumulative`
- `nasa_keplerstellar_koi.csv`: `select s.kepid,s.dist,s.dist_err1,s.dist_err2,s.st_delivname from keplerstellar s where s.dist is not null and s.kepid in (select kepid from cumulative where koi_disposition='CANDIDATE')` (la tabla `q1_q17_dr25_stellar` ya no se puede consultar; `keplerstellar` trae sus dos entregas DR25)
- `nasa_k2pandc.csv`: `select pl_name,hostname,epic_hostname,disposition,default_flag,ra,dec,pl_rade,pl_bmasse,pl_orbper,sy_dist,st_teff from k2pandc`

`nasa_science_catalog_types.csv`: tipo de planeta de cada ficha del catálogo de la NASA (`https://science.nasa.gov/exoplanets/exoplanet-catalog/`), leído de su API pública de listados (`https://science.nasa.gov/wp-json/smd/v1/content-list/`, 65 páginas de 100, `orderby=title`) con `scripts/exoplanets/fetch_nasa_catalog_types.py`. La columna `tipo_en_texto` sale del resumen de cada ficha («… is a super Earth exoplanet …»); los títulos conservan las entidades HTML de origen.
