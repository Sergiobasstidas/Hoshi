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
