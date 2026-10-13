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
