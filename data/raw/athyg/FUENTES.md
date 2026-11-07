# Fuentes de `data/raw/athyg`

Catálogo AT-HYG (Augmented Tycho-HYG) v3.2 completo, de David Nash (astronexus). Descarga realizada con `curl -sSL` desde el Mac de Sergio el 07/11/2026 a las 12:15 (zona -03:00). Archivos tal como los entrega el repositorio, comprimidos.

- Repositorio: `https://codeberg.org/astronexus/athyg`
- Versión: v3.2, commit `10d527764443fcc4f319e478e0ba3b87565a6d4c` (13/02/2025). La rama `main` ya está en v4.0, por eso se fija el commit.
- Licencia: CC BY-SA 4.0 (`https://creativecommons.org/licenses/by-sa/4.0/`), aplicable a AT-HYG v3.0 y posteriores.
- Los archivos están en Git LFS; el sha256 coincide con el `oid` del puntero LFS de ese commit.

| Archivo | URL | Tamaño (bytes) | Filas de datos | sha256 |
| --- | --- | ---: | ---: | --- |
| `athyg_v32-1.csv.gz` | `https://codeberg.org/astronexus/athyg/media/commit/10d527764443fcc4f319e478e0ba3b87565a6d4c/data/athyg_v32-1.csv.gz` | 98906100 | 1276082 | `c71d6863d1bbab46511bf680209e424ece9435790e46025f12477a105edd1c2f` |
| `athyg_v32-2.csv.gz` | `https://codeberg.org/astronexus/athyg/media/commit/10d527764443fcc4f319e478e0ba3b87565a6d4c/data/athyg_v32-2.csv.gz` | 100113696 | 1276083 | `bd8fe86f089c7fd3104761458cd2b0c9955ea97259440585164e4b24ed9d2fd8` |

Total: 2 552 165 estrellas. Solo la primera parte trae cabecera; la segunda continúa sin ella (el autor indica concatenarlas).

## Cabecera

`id,tyc,gaia,hyg,hip,hd,hr,gl,bayer,flam,con,proper,ra,dec,pos_src,dist,x0,y0,z0,dist_src,mag,absmag,ci,mag_src,rv,rv_src,pm_ra,pm_dec,pm_src,vx,vy,vz,spect,spect_src`

## Relación con `data/raw/hyglike_from_athyg_v32.csv`

El subconjunto HYGLike que usa Hoshi sale de esta misma versión. Comprobado el 07/11/2026: de sus 118 971 filas, 118 970 tienen el mismo `id` en el catálogo completo con `hip`, `hd`, `hr`, `gl`, `proper`, `ra` y `dec` idénticos. La única excepción es el Sol: `id` 0 en HYGLike e `id` 1 en el catálogo completo.

Uso: `scripts/catalog/build_hsb.js` lee estos archivos para el registro HSB (`data/catalog/hsb_registro.csv`).

## AT-HYG v4.0 (`data/raw/athyg/v40/`, solo para comparar)

Descarga realizada con `curl -sSL` el 07/11/2026 a las 12:24 (zona -03:00), desde la rama `main` de `https://codeberg.org/astronexus/athyg`, commit `eebe42b3552ae04e67d27ae085a8aad997b42bc0` (26/07/2026). Licencia CC BY-SA 4.0. sha256 iguales al `oid` LFS.

| Archivo | URL | Tamaño (bytes) | Filas de datos | sha256 |
| --- | --- | ---: | ---: | --- |
| `athyg_40.csv.gz` | `https://codeberg.org/astronexus/athyg/media/commit/eebe42b3552ae04e67d27ae085a8aad997b42bc0/data/athyg_40.csv.gz` | 199688001 | 2558654 | `69ad04dd33d7c7bb4f5e1b4682798075811547ea9fb8d0e802e5b319c46818a6` |
| `hyglike_from_athyg_v40.csv.gz` | `https://codeberg.org/astronexus/athyg/media/commit/eebe42b3552ae04e67d27ae085a8aad997b42bc0/data/subsets/hyglike_from_athyg_v40.csv.gz` | 14096722 | 119670 | `fa59658677ebb4331056d99ee01a519102123081d1d89f2add77c15076eb9053` |

Diferencias de formato con la v3.2:

- Los `id` del catálogo completo se renumeran: el archivo va ordenado por ascensión recta y las estrellas nuevas desplazan a las siguientes. Un mismo `id` apunta a otra estrella en casi todos los casos (solo 638 de 2 552 165 conservan el mismo TYC con el mismo `id`).
- En la HYGLike v4.0 la columna `id` es el número de HYG (igual a `hyg`); el `id` de AT-HYG pasa a `comp_primary`.
- `gl` va sin el prefijo `Gl`/`GJ` (por ejemplo `244A` en vez de `Gl 244A`).
- `pm_ra` y `pm_dec` pasan a llamarse `pmra` y `pmdec`.

Uso: `scripts/catalog/build_hsb.js` lee el catálogo completo y la HYGLike v4.0 para llenar la columna `athyg_v40` del registro HSB y dar de alta las compañeras nuevas y las filas que entran al corte. Hoshi sigue dibujando las estrellas desde la HYGLike v3.2.
