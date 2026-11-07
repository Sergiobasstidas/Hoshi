# Fuentes de `data/raw/gcns`

Gaia Catalogue of Nearby Stars (GCNS; Gaia Collaboration, Smart et al. 2021, A&A 649, A6, https://doi.org/10.1051/0004-6361/202039498). Descarga hecha con `python3 scripts/catalog/descargar_cercanas.py gcns` desde el Mac de Sergio el 07/11/2026, entre las 14:06 y las 14:08 (zona -03:00). Datos tal como los entrega el servicio: solo se unen las franjas bajo una cabecera y se comprime con gzip (mtime 0).

- Servicio: TAP de GAVO Data Center (Heidelberg), `https://dc.zah.uni-heidelberg.de/tap`, tabla `gcns.main`, consulta síncrona en 12 franjas de ascensión recta. Se comprobó que el total coincide con `SELECT COUNT(*) FROM gcns.main`.
- Licencia: «Gaia Catalogue of Nearby Stars © 2023 by Richard Smart is licensed under CC BY-NC 4.0» (según GAVO). Es una licencia **no comercial**.
- Columnas: `source_id, ra, dec, parallax, parallax_error, pmra, pmdec, ruwe, phot_g_mean_mag, phot_bp_mean_mag, phot_rp_mean_mag, adoptedrv, adoptedrv_error, adoptedrv_refname, gcns_prob, wd_prob, name_2mass, name_wise`. No se bajan `dist_*` ni las coordenadas y velocidades derivadas de ellas: salen de un modelo de distancias (regla D-014).

| Archivo | Bytes | Filas de datos | sha256 |
| --- | ---: | ---: | --- |
| `gcns_main.csv.gz` | 28259737 | 331312 | `7ca25a6687ba64d4db4e24a5d772ca64109d091f3ecaaf539c422b0f18a8c367` |

Uso: `scripts/catalog/build_hsb.js` da número HSB a las fuentes con `gcns_prob` ≥ 0,38 (umbral del artículo) y paralaje/error ≥ 10 que no son ya una estrella del registro.
