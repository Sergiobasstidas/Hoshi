// scripts/catalog/famosas.js
// Estrellas famosas que no estaban en el catálogo de Hoshi (ni en AT-HYG ni entre las anfitrionas), que se suman como
// estrellas propias para que tengan ficha y nombre (build_famosas.js). Cada una con su Gaia DR3, su nombre, sus otros
// nombres y su tipo espectral de SIMBAD (espejo de Harvard; null si SIMBAD no da uno publicado). Los radios y temperaturas
// van en estrellas_curadas.js (ESTRELLAS_CURADAS_POR_ID), con la regla de radios de siempre.
// Distancia: 1000 / paralaje de Gaia DR3 cuando el error es ≤ 10 % y el RUWE < 1,4 (regla del catálogo); si no, la
// curada en distancias_curadas.js (DISTANCIAS_FAMOSAS, por su Gaia DR3), con su cita.
// Magnitud: G y BP−RP de Gaia (photometry.js, vDeGaiaConRango) o la V publicada en `v`.
// `posicion`: posición J2000 publicada, cuando Gaia no trae movimiento propio para llevarla a J2000.
// `primaria` y `comp`: compañera de una estrella del catálogo (Pulcherrima, ε Boo B, de Izar).
export const FAMOSAS = [
  {
    // UY Scuti: supergigante roja. Gaia DR3 4152993273702130432: paralaje 0,5166 ± 0,0494 mas (9,6 %), RUWE 1,04, G 6,75
    // (TAP de ARI Heidelberg). Otros nombres y tipo espectral (M4Iae, 1956PASP...68..152B) confirmados en SIMBAD.
    id: 'uy-sct', nombre: 'UY Scuti', gaia: '4152993273702130432', sp: 'M4Iae',
    alias: ['UY Sct', 'BD-12 5055', 'IRC -10422', 'HV 3805', 'TYC 5698-5176-1', 'IRAS 18248-1229', '2MASS J18273652-1227589', 'TIC 177198220', 'PPM 234561', 'RAFGL 2162'],
  },
  // RS Persei: supergigante roja del cúmulo doble de Perseo (NGC 884; miembro en el UCC con probabilidad 0,827). Su paralaje
  // propia (0,3874 ± 0,0450 mas, 11,6 %) no alcanza: va la del cúmulo. SIMBAD: M3.5IabFe-1 (1989ApJS...71..245K).
  { id: 'rs-per', nombre: 'RS Persei', gaia: '458407464445792384', sp: 'M3.5IabFe-1', alias: ['RS Per', 'HD 14488'] },
  // Pulcherrima (ε Boo B, nombre IAU del 2026-04-15): Gaia DR3 1279798789901591168 (G 4,94, sin paralaje). Distancia la
  // del sistema (Izar, Hipparcos 2007, HIP 72105, 16,10 mas); V 5,12 del BSC5 (HR 5505; Hoffleit & Warren 1991); posición
  // del CSN del WGSN. SIMBAD: A0V (1995ApJS...99..135A).
  {
    id: 'pulcherrima', nombre: 'Pulcherrima', gaia: '1279798789901591168', sp: 'A0V', primaria: 1458789, comp: 'B',
    alias: ['Eps Boo B', 'Epsilon Boötis B', 'HR 5505', 'HD 129988', 'ADS 9372 B'],
    distanciaDe: 1458789, v: { valor: 5.12, fuente: 'BSC5 (HR 5505; Hoffleit & Warren 1991)' },
    posicion: { ra: 221.2464574, dec: 27.07498559, fuente: 'CSN del WGSN (IAU)' },
  },
  // Estrella de Tabby: Gaia DR3 2,2545 ± 0,0099 mas (0,44 %), RUWE 0,815. SIMBAD: F3V (Boyajian et al. 2016).
  { id: 'tabby', nombre: "Tabby's Star", gaia: '2081900940499099136', sp: 'F3V',
    alias: ['Estrella de Tabby', "Boyajian's Star", 'Estrella de Boyajian', 'KIC 8462852', 'TYC 3162-665-1', '2MASS J20061546+4427248'] },
  // V404 Cygni: agujero negro con compañera; paralaje de radio (DISTANCIAS_FAMOSAS). SIMBAD: G9/K0III/V.
  { id: 'v404-cyg', nombre: 'V404 Cygni', gaia: '2056188624872569088', sp: 'G9/K0III/V', alias: ['V404 Cyg'] },
  // NML Cygni: paralaje de máseres (DISTANCIAS_FAMOSAS). Única fuente brillante de Gaia a 11″ (G 11,148). SIMBAD: M7/8.
  { id: 'nml-cyg', nombre: 'NML Cygni', gaia: '2065235853217670656', sp: 'M7/8', alias: ['NML Cyg', '2MASS J20462554+4006594'] },
  // Westerlund 1-26: paralaje del cúmulo Westerlund 1 (DISTANCIAS_FAMOSAS). SIMBAD: M2-5Ia (2020A&A...635A.187C).
  { id: 'w26', nombre: 'Westerlund 1-26', gaia: '5940106041452150272', sp: 'M2-5Ia',
    alias: ['W26', 'Wd1-W26', 'Westerlund 1 W26', '2MASS J16470540-4550367'] },
  // Gaia BH1, BH2 y BH3: paralaje de su solución orbital (DISTANCIAS_FAMOSAS). SIMBAD no da tipo publicado (para BH3 solo
  // la «B» genérica del catálogo LS, sin referencia).
  { id: 'gaia-bh1', nombre: 'Gaia BH1', gaia: '4373465352415301632', sp: null, alias: [] },
  { id: 'gaia-bh2', nombre: 'Gaia BH2', gaia: '5870569352746779008', sp: null, alias: [] },
  { id: 'gaia-bh3', nombre: 'Gaia BH3', gaia: '4318465066420528000', sp: null, alias: ['LS II +14 13', '2MASS J19391872+1455542'] },
  // LP 40-365: Gaia DR3 1,6375 ± 0,0257 mas (1,6 %), RUWE 1,034. SIMBAD: DZ (2017Sci...357..680V).
  { id: 'lp-40-365', nombre: 'LP 40-365', gaia: '1711956376295435520', sp: 'DZ', alias: ['2MASS J14063545+7418579', 'GD 492'] },
  // 2MASS J18082002-5104378: Gaia DR3 1,6562 ± 0,0151 mas (0,9 %), RUWE 0,949. SIMBAD: «CEMP» (no es un tipo espectral).
  { id: 'j1808', nombre: '2MASS J18082002-5104378', gaia: '6702907209758894848', sp: null, alias: ['2MASS J1808-5104'] },
  // V838 Monocerotis: eco de luz (DISTANCIAS_FAMOSAS). SIMBAD: M10+B3V (2003IAUC.8202....1W).
  { id: 'v838-mon', nombre: 'V838 Monocerotis', gaia: '3107789548859766016', sp: 'M10+B3V', alias: ['V838 Mon'] },
  // Paloma (nombre IAU del 2026-04-19): Gaia DR3 1,6883 ± 0,0774 mas (4,6 %), RUWE 1,019. Sin tipo en SIMBAD.
  { id: 'paloma', nombre: 'Paloma', gaia: '195266088206848768', sp: null, alias: ['2MASS J05243042+4244506'] },
  // Estrella de Caffau: Gaia DR3 0,6482 ± 0,0598 mas (9,2 %), RUWE 1,039. SIMBAD: sdA (2019MNRAS.486.2169K).
  { id: 'caffau', nombre: "Caffau's Star", gaia: '3890626773968983296', sp: 'sdA',
    alias: ['Estrella de Caffau', 'SDSS J102915.14+172927.9', 'SDSS J1029+1729'] },
  // Dust-Ball (V927 Per, nombre IAU del 2026-06-13): miembro de IC 348 en el UCC (probabilidad 1); su paralaje propia falla
  // por RUWE 2,40: va la del cúmulo (DISTANCIAS_FAMOSAS). SIMBAD: A0 (2009AJ....138..703C).
  { id: 'dust-ball', nombre: 'Dust-Ball', gaia: '216708248573262208', sp: 'A0', alias: ['V927 Per', 'V927 Persei'] },
];
export const ADDED_FAMOSAS_JSON = './data/catalog/added_famosas.json';
