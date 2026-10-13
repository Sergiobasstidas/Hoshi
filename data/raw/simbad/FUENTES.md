# Fuentes de `data/raw/simbad`

Descarga realizada con `python3 scripts/catalog/descargar_simbad.py` (biblioteca estándar, Python 3.9.6) desde el Mac de Sergio el 13/10/2026 (zona -03:00). El CSV principal contiene las respuestas del servicio sin modificar, unidas bajo una única cabecera; el mapa y la lista de no resueltos los genera el script.

Servicio: TAP de SIMBAD (CDS), `https://simbad.cds.unistra.fr/simbad/sim-tap/sync`, `REQUEST=doQuery`, `LANG=ADQL`, `FORMAT=csv`, `MAXREC=2000000`, por `POST`.

| Archivo | Descarga (hora local, -03:00) | Tamaño (bytes) | Líneas | Columnas | sha256 |
| --- | --- | ---: | ---: | ---: | --- |
| `simbad_exoplanet_hosts.csv` | 2026-10-13 02:27:22–02:45:59 | 4676442 | 58481 | 6 | `56fb90bb467f13cc3be5347db22ba7f64e752384f39e9d6eed5e2ca12c600789` |
| `simbad_exoplanet_hosts_mapa.csv` | ídem (derivado) | 440711 | 4843 | 4 | `4ad86abb6a8fac7cb7e1660e45fade41e6a0dc5104fa6fb184e86a888c11b932` |
| `simbad_exoplanet_hosts_no_resueltos.txt` | ídem (derivado) | 5662 | 304 | 1 | `bb118c4ffd3529785de7c8df7f0260e7cfcdb5eabd9eab2d683c06d887379986` |

Las líneas de los CSV incluyen la cabecera; el `.txt` no tiene cabecera (un hostname por línea).

- `simbad_exoplanet_hosts.csv` — cabecera `query_id,main_id,otype,sp_type,plx_value,alias`; una fila por alias. 58480 filas, 4538 `query_id` y 4537 `main_id` distintos.
- `simbad_exoplanet_hosts_mapa.csv` — cabecera `hostname,gaia_dr3_id,enviado,query_id`; una fila por cada uno de los 4842 anfitriones de `data/raw/exoplanets/nasa_pscomppars_ids.csv`. `enviado` es el identificador con el que se encontró y `query_id` la forma que devolvió SIMBAD (clave para unir con el CSV principal); ambos vacíos si no se resolvió.

## Consulta exacta

Siempre la misma, en lotes de hasta 300 identificadores con pausa de 2 s:

```sql
SELECT i1.id AS query_id, b.main_id, b.otype, b.sp_type, b.plx_value, i2.id AS alias FROM ident AS i1 JOIN basic AS b ON b.oid = i1.oidref JOIN ident AS i2 ON i2.oidref = b.oid WHERE i1.id IN ('<id 1>', '<id 2>', …)
```

Pasadas:

1. Los 4472 `gaia_dr3_id` únicos, enviados como `Gaia DR3 <source_id>` (15 lotes): 4446 resueltos.
2. Los 370 anfitriones sin `gaia_dr3_id`, enviados por `hostname` tal cual (2 lotes): 87 resueltos.
3. Repesca, no pedida en el encargo original: los 26 anfitriones cuyo id de Gaia no está en SIMBAD, por `hostname`: 5 resueltos.

Total: 4538 de 4842 anfitriones resueltos; 304 sin resolver (274 son lentes de microlente o transitorios — `…-BLG-…L`, `Gaia2…L`, `AT20…L` —, 18 son `TIC …` y 12 otros; lista completa en el `.txt`).

## Incidencias

- Sin errores HTTP ni límites; todas las peticiones respondieron al primer intento.
- SIMBAD compara `ident.id` con su propia normalización y devuelve su forma, no la enviada: `alf Tau` vuelve como `* alf Tau`, `HD 6860` como `HD   6860`, `OGLE-2012-BLG-0026L` como `NAME OGLE-2012-BLG-0026L`. Ocurre en 19 anfitriones consultados por nombre. Para saber a qué hostname corresponde cada forma, el script reconsulta de uno en uno los nombres sin emparejar de los lotes afectados (unas 300 peticiones, ~17 min); esas respuestas solo alimentan el mapa y no se añaden al CSV. Usar el mapa, no una comparación de texto, para unir.
- Coincidencias por nombre que conviene revisar antes de fiarse:
  - `TOI-2267 B` → `TOI-2267b` (`main_id` `TOI-2267.03`, otype `Pl?`): es un candidato a planeta, no la estrella B; la comparación no distingue mayúsculas.
  - `SWEEPS-4` y `SWEEPS-11` → otype `Pl` (la entrada de SIMBAD es el planeta).
  - `HD 41004 A` → `main_id` `HD  41004`, el mismo objeto que resuelve `Gaia DR3 4794830231453653888` (otro anfitrión del archivo de la NASA); por eso hay 4538 `query_id` y 4537 `main_id`.
  - `Gl 725 B` → `GJ 725 B` (`HD 173740`); `HIP 81208 C` → `HD 149274C`; `CD-35 2722 B` → otype `BD*`.
- Una primera ejecución (02:24:45–02:26:35, sin el mapa) produjo un CSV principal idéntico byte a byte.
