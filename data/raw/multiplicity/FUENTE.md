# Sixth Catalog of Orbits of Visual Binary Stars (ORB6)

Descargado el 13/10/2026 desde el espejo de Georgia State University del Washington Double Star Catalog:

- `orb6orbits.txt` — https://www.astro.gsu.edu/wds/orb6/orb6orbits.txt (elementos orbitales)
- `orb6format.txt` — https://www.astro.gsu.edu/wds/orb6/orb6format.txt (formato de columnas)
- `orb6ephem.txt` — https://www.astro.gsu.edu/wds/orb6/orb6ephem.txt (efemérides 2025–2029, usadas solo para validar)

Mantenido por el U.S. Naval Observatory (Hartkopf, Mason y Worley; actualización continua). Archivos sin modificar. Cita solicitada por los autores: «Sixth Catalog of Orbits of Visual Binary Stars», USNO. Cada órbita conserva su código de referencia original en la columna `REF`.

Procesado por `scripts/process_binaries.js`. Detalle en `docs/BINARIAS.md`.

# Washington Double Star Catalog (WDS)

Descargado el 13/10/2026 desde el mismo espejo:

- `wdsweb_summ2.txt` — https://www.astro.gsu.edu/wds/Webtextfiles/wdsweb_summ2.txt (resumen por par con coordenadas precisas; 157.980 pares)
- `wdsweb_format.txt` — https://www.astro.gsu.edu/wds/Webtextfiles/wdsweb_format.txt (formato y códigos de notas)

Mantenido por el U.S. Naval Observatory (Mason, Wycoff, Hartkopf, Douglass y Worley). Archivos sin modificar. Se usan los pares marcados como físicos (códigos T, V o Z, sin S, U, Y ni X) y el tipo espectral de la compañera.

# Multiple Star Catalog (MSC)

Descargado el 13/10/2026 del CDS, catálogo J/ApJS/235/6 (versión actualizada a diciembre de 2023), en `msc/`:

- `ReadMe`, `catalog.dat.gz`, `systems.dat.gz`, `orbits.dat` — https://cdsarc.cds.unistra.fr/ftp/J/ApJS/235/6/

Autor: A. Tokovinin (2018, ApJS 235, 6; doi:10.26093/cds/vizier.22350006). Archivos sin modificar. Se usan las masas estimadas de cada par, la jerarquía, los tipos espectrales y las posiciones e identificadores de componentes. `orbits.dat` se conserva pero no se procesa.

# Ninth Catalogue of Spectroscopic Binary Orbits (SB9)

Descargado el 13/10/2026 del CDS, catálogo B/sb9 (versión 2013-10-27), en `sb9/`:

- `ReadMe`, `main.dat`, `orbits.dat` — https://cdsarc.cds.unistra.fr/ftp/B/sb9/

Autores: Pourbaix et al. (2004, A&A 424, 727). Archivos sin modificar. Solo se usa el cociente de amplitudes de velocidad K1/K2 de las binarias de doble línea, que mide la razón de masas, cuando su período coincide con el de una órbita visual ya aceptada.

# Masas dinámicas publicadas (selección verificada)

En `scripts/published_binary_masses.js`, cada valor con su referencia. Comprobados el 13/10/2026 contra el resumen de cada artículo en arXiv.
