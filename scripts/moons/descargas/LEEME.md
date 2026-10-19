# Descarga de las fuentes de lunas y anillos

Las fuentes viven en `data/moons/fuentes/` y `data/rings/fuentes/`, que no se versionan. Para rehacerlas (consultadas el 14/10/2026):

- `elem.html` ← https://ssd.jpl.nasa.gov/sats/elem/ y `phys.html` ← https://ssd.jpl.nasa.gov/sats/phys_par/; `parse.mjs` (desde `data/moons/fuentes/`) extrae `elem.json`; `phys.json` sale igual de la tabla `sat_phys_par` de `phys.html`.
- `wiki_Jupiter.txt` ← https://en.wikipedia.org/w/index.php?title=Moons_of_Jupiter&action=raw y `wiki_Saturn.txt` ← https://en.wikipedia.org/w/index.php?title=Moons_of_Saturn&action=raw (CC BY-SA; solo se toman la magnitud absoluta y el diámetro de cada fila).
- `hz.json`, `osc.json`, `inner.json`: JPL Horizons, con `hz.mjs` y `oscall.mjs` (ejecutar en `data/moons/fuentes/`) e `inner.mjs` (desde la raíz).
- `ringfact.html` ← https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html (consulta).
- `data/rings/fuentes/UVIS_HSP_2008_231_BETCEN_I_TAU10KM.TAB` y `.LBL` ← https://pds-rings.seti.org/holdings/volumes/COUVIS_8xxx/COUVIS_8001/data/

Después: `node scripts/moons/build_moons.js` y `node scripts/rings/build_rings.js`.
