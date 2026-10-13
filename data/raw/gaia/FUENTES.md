# Fuentes de `data/raw/gaia`

Descarga realizada con `python3 scripts/catalog/descargar_gaia.py` (biblioteca estándar, Python 3.9.6) desde el Mac de Sergio el 13/10/2026 (zona -03:00). Datos crudos tal como los entrega el servicio; solo se unen los lotes bajo una única cabecera.

Servicio: TAP del Archivo Gaia de ESA, `https://gea.esac.esa.int/tap-server/tap`, Gaia DR3, acceso anónimo, `LANG=ADQL`, `FORMAT=csv`.

| Archivo | Descarga (hora local, -03:00) | Tamaño (bytes) | Líneas | Filas de datos | Columnas | sha256 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `gaia_dr3_hip.csv` | 2026-10-13 02:15:33–02:24:57 | 20873977 | 99526 | 99525 | 19 | `761f6be4877cc972a8c4656b17334e70c16cec96c7c22ea08f362f7294f307f6` |
| `gaia_dr3_exoplanet_hosts.csv` | 2026-10-13 02:14:23–02:15:33 | 871546 | 4473 | 4472 | 16 | `1c19397de34c3457015db855943793262ca7beac323381acf86ed84104244dc0` |

Las líneas incluyen la cabecera.

## Cabeceras

- `gaia_dr3_hip.csv`: `hip,angular_distance,number_of_neighbours,source_id,ra,dec,ref_epoch,parallax,parallax_error,pmra,pmdec,radial_velocity,phot_g_mean_mag,bp_rp,ruwe,non_single_star,teff_gspphot,radius_gspphot,distance_gspphot`
- `gaia_dr3_exoplanet_hosts.csv`: las mismas desde `source_id` (sin `hip`, `angular_distance`, `number_of_neighbours`).

## Consultas exactas

### `gaia_dr3_hip.csv`

Trabajo asíncrono: `POST https://gea.esac.esa.int/tap-server/tap/async` con `REQUEST=doQuery`, `LANG=ADQL`, `FORMAT=csv`, `PHASE=RUN`; resultado en `<trabajo>/results/result`.

```sql
SELECT n.original_ext_source_id AS hip, n.angular_distance, n.number_of_neighbours, g.source_id, g.ra, g.dec, g.ref_epoch, g.parallax, g.parallax_error, g.pmra, g.pmdec, g.radial_velocity, g.phot_g_mean_mag, g.bp_rp, g.ruwe, g.non_single_star, g.teff_gspphot, ap.radius_gspphot, g.distance_gspphot FROM gaiadr3.hipparcos2_best_neighbour AS n JOIN gaiadr3.gaia_source AS g ON g.source_id = n.source_id LEFT JOIN gaiadr3.astrophysical_parameters AS ap ON ap.source_id = g.source_id
```

Comprobación de que no se cortó (`/sync`), hecha por el script antes de guardar:

```sql
SELECT COUNT(*) AS n FROM gaiadr3.hipparcos2_best_neighbour
```

Resultado: 99525, igual a las filas recibidas. Los 99525 `hip` y los 99525 `source_id` son únicos.

### `gaia_dr3_exoplanet_hosts.csv`

`POST https://gea.esac.esa.int/tap-server/tap/sync`, 9 lotes de hasta 500 `source_id` con pausa de 2 s. Los ids son los `gaia_dr3_id` únicos de `data/raw/exoplanets/nasa_pscomppars_ids.csv` sin el prefijo `Gaia DR3 ` (4472 ids de 4842 anfitriones; 370 anfitriones no tienen `gaia_dr3_id`).

```sql
SELECT g.source_id, g.ra, g.dec, g.ref_epoch, g.parallax, g.parallax_error, g.pmra, g.pmdec, g.radial_velocity, g.phot_g_mean_mag, g.bp_rp, g.ruwe, g.non_single_star, g.teff_gspphot, ap.radius_gspphot, g.distance_gspphot FROM gaiadr3.gaia_source AS g LEFT JOIN gaiadr3.astrophysical_parameters AS ap ON ap.source_id = g.source_id WHERE g.source_id IN (<hasta 500 source_id separados por coma>)
```

Pedidos 4472 ids; devueltas 4472 filas, todas con `source_id` distinto; ninguno sin fila.

## Incidencias

- **Cambio respecto a la consulta pedida:** `radius_gspphot` no existe en `gaiadr3.gaia_source` (el servicio respondió HTTP 400, `Unknown column "g.radius_gspphot"`). Está en `gaiadr3.astrophysical_parameters`, así que ambas consultas lo toman de ahí con `LEFT JOIN` por `source_id`. El resto de columnas sale de `gaia_source` como se pidió. El `LEFT JOIN` no cambia el número de filas.
- Cobertura: `radius_gspphot` tiene valor en 64541 de 99525 filas HIP y en 3955 de 4472 anfitriones; `parallax` en 98004 de 99525 filas HIP. Las celdas vacías son nulos del catálogo.
- El trabajo asíncrono tardó unos 9 minutos; sin errores de red ni límites.
- `/sync` de este servicio corta los resultados grandes; por eso la tabla HIP usa `/async`.
- Posiciones en la época `ref_epoch` (2016.0), ICRS; no se propagaron a J2000.

## Enlace por posición (13/10/2026, 10:33–10:50 -03:00)

Generado con `python3 scripts/catalog/cruzar_gaia_posicion.py xmatch` y luego `validar`. Servicio: CDS XMatch, `http://cdsxmatch.u-strasbg.fr/xmatch/api/v1/sync`, `request=xmatch`, `cat2=vizier:I/355/gaiadr3`, `colRA1=ra`, `colDec1=dec`, `RESPONSEFORMAT=csv`; columnas adicionales desde el TAP de ESA con la misma consulta por `source_id` que `gaia_dr3_exoplanet_hosts.csv`.

| Archivo | Contenido | Tamaño (bytes) | Filas de datos | sha256 |
| --- | --- | ---: | ---: | --- |
| `xmatch_subida_posicion.csv` | `id,ra,dec` enviados: 19.385 filas de AT-HYG sin enlace por HIP, posición propagada de J2000 a 2016.0 con el movimiento propio de AT-HYG | 592558 | 19385 | `ba091dd5905e6a55d748a2cf834deb46961ff06248c1208239513ed5a7fa47c2` |
| `xmatch_gaia_dr3_posicion.csv` | Respuesta cruda, radio 5″ | 20253744 | 22571 | `01badac8d80a6ec4c1c091c5231f3f7c827a42567f34680223e1c5c17f86924e` |
| `xmatch_gaia_dr3_posicion_amplio.csv` | Radio 180″ para las 952 filas con `pos_src = GJ` y distancia Gaia. **No es la respuesta cruda:** pesaba 195 MB y se redujo a 14 columnas (`angDist,id,ra,dec,Source,RAdeg,DEdeg,Plx,e_Plx,pmRA,pmDE,Gmag,BP-RP,RUWE`) | 34029460 | 244771 | `cfc1394e2ccf7ddae34e4247520299373be16731be84f3f2432dc1f763a5708e` |
| `gaia_dr3_posicion.csv` | Pares aceptados: `id` (AT-HYG), `angular_distance`, `number_of_neighbours` (candidatos en el radio), `validacion` y las 16 columnas de Gaia | 3983777 | 18773 | `45819fe5570b01f0e39481ab488576aa32531f8507213bafcf86c4d34832bb46` |
| `gaia_dr3_posicion_rechazados.csv` | Candidatos descartados con su motivo | 361845 | — | — |

Validación (constantes al inicio del script): paralaje compatible con la distancia de AT-HYG (±20 % o ±2,5 mas + 3σ) y V predicha desde G y BP−RP (Riello et al. 2021) a ±1 mag; exactamente un candidato válido, si no se descarta por ambiguo. Sin paralaje en Gaia: separación ≤ 1,5″ y magnitud a ±0,5 (`validacion = mag`). Radio amplio: paralaje a ±1 % y movimiento propio a ±2 mas/año o 2 % (`plx+pm`). Una fuente Gaia asignada a dos estrellas descarta ambas.
