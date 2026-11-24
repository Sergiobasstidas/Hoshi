// Supergigantes brillantes cuya paralaje de Hipparcos falla (saturan a Gaia): distancia medida y publicada,
// por paralaje de máseres o de radio, o la de su asociación medida con Gaia. Por ID de AT-HYG; la aplica
// catalog_patches.js después de las correcciones de Gaia DR3.
const ZHANG = 'Zhang et al. 2012, ApJ 744, 23 (paralaje de máser SiO, 0,83 ± 0,08 mas)';
const HARPER = 'Harper et al. 2017, AJ 154, 11 (radio con Hipparcos, 4,51 ± 0,80 mas)';
const BRICENO = 'Briceño et al. 2019, AJ 157, 85, arXiv:1805.01008 (Orión OB1b con Gaia DR2)';

// α Centauri A y B: Hipparcos 2007 da paralajes distintas a las dos (754,81 y 796,92 mas) y Gaia satura.
const KERVELLA = 'Kervella et al. 2016, A&A 594, A107 (paralaje del par, 747,17 ± 0,61 mas)';

// Sirio: la paralaje de Gaia de Sirio B está contaminada por el brillo de Sirio A (a ~10″) y Gaia satura con A.
const BOND = 'Bond et al. 2017, ApJ 840, 70, arXiv:1703.10625 (paralaje adoptada del sistema, 378,9 mas: Hipparcos 2007 y Gatewood & Gatewood 1978)';

// Estrellas con nombre sin paralaje con error ≤ 10 % (auditoría, decisión B, aprobada por Sergio el 08/11/2026).
// Antares, Alniyat (σ Sco) y Fang (π Sco): miembros de Upper Scorpius según de Zeeuw et al. (1999, 1999AJ....117..354D;
// probabilidad 100, 94 y 98 %); distancia del grupo: mediana de las paralajes de Gaia DR1 de sus 169 miembros
// brillantes, 146 pc (Luhman et al. 2018, 2018AJ....156..271L).
const UPPER_SCO = 'Upper Scorpius: de Zeeuw et al. 1999, AJ 117, 354 (pertenencia) y Luhman et al. 2018, AJ 156, 271 (mediana de las paralajes de Gaia DR1 de 169 miembros brillantes, 146 pc)';
// Mekbuda (ζ Gem, cefeida): paralaje de HST/FGS, 2,78 ± 0,18 mas (Benedict et al. 2007, 2007AJ....133.1810B).
const BENEDICT = 'Benedict et al. 2007, AJ 133, 1810 (paralaje de HST/FGS, 2,78 ± 0,18 mas)';

// Decisión N (aprobada por Sergio el 08/11/2026): miembros de cúmulos del UCC cuya única distancia es de Hipparcos y no
// calza con la del cúmulo: la del cúmulo, 1/paralaje media de sus miembros con Gaia DR3 (Perren et al. 2023, MNRAS 526,
// 4107, 2023MNRAS.526.4107P; versión 260615).
const UCC = (cumulo, plx) => `${cumulo}: Unified Cluster Catalogue, Perren et al. 2023, MNRAS 526, 4107 (paralaje media del cúmulo con Gaia DR3, ${plx} mas)`;
// Decisión O: θ¹ Orionis B, en el cúmulo de la Nebulosa de Orión: distancia del cúmulo por paralaje VLBA, 388 ± 5 pc
// (Kounkel et al. 2017, ApJ 834, 142, 2017ApJ...834..142K). Su sistema la comparte (distancia_sistemas.js).
const KOUNKEL = 'Kounkel et al. 2017, ApJ 834, 142 (cúmulo de la Nebulosa de Orión por paralaje VLBA, 388 ± 5 pc)';

// Pléyades brillantes (aprobado por Sergio el 16/11/2026): miembros del cúmulo en el UCC sin paralaje fiable de Gaia
// (sin paralaje, o con RUWE ≥ 1,4) cuya distancia salía de Hipparcos, que en las Pléyades tiene un sesgo conocido:
// la del cúmulo, como en la decisión N. Las que tienen Gaia fiable (Pleione, Celaeno, Asterope…) conservan la suya.
const PLEYADES = UCC('Pléyades', '7,3612');

export const DISTANCIAS_CURADAS = [
  { i: 280634, n: 'HIP 17999', dNueva: 135.8474, fuente: PLEYADES },
  { i: 276732, n: 'Alcyone', dNueva: 135.8474, fuente: PLEYADES }, // Gaia DR3 sin paralaje
  { i: 274126, n: 'Taygeta', dNueva: 135.8474, fuente: PLEYADES }, // RUWE 2,31
  { i: 278603, n: 'Atlas', dNueva: 135.8474, fuente: PLEYADES }, // RUWE 4,12
  { i: 273761, n: 'Electra', dNueva: 135.8474, fuente: PLEYADES }, // RUWE 2,77
  { i: 274844, n: 'Maia', dNueva: 135.8474, fuente: PLEYADES }, // RUWE 3,54
  { i: 275407, n: 'Merope', dNueva: 135.8474, fuente: PLEYADES }, // RUWE 2,33
  { i: 279525, n: 'HIP 17921', dNueva: 135.8474, fuente: PLEYADES }, // RUWE 2,10
  { i: 681688, n: 'HIP 35226', dNueva: 299.3922, fuente: UCC('Collinder 135', '3,3401') },
  { i: 1583688, n: 'HIP 79031', dNueva: 157.0968, fuente: UCC('HSC 2907', '6,3655') },
  { i: 1658655, n: 'Pipirima', dNueva: 176.0532, fuente: UCC('UPK 640', '5,6801') },
  { i: 100001450, n: 'θ¹ Orionis B', dNueva: 388, fuente: KOUNKEL },
  { i: 1620181, n: 'Antares', dNueva: 146, fuente: UPPER_SCO },
  { i: 1605930, n: 'Alniyat', dNueva: 146, fuente: UPPER_SCO },
  { i: 1569628, n: 'Fang', dNueva: 146, fuente: UPPER_SCO },
  { i: 641742, n: 'Mekbuda', dNueva: 359.7122, fuente: BENEDICT },
  { i: 584955, n: 'Sirius', dNueva: 2.639219, fuente: BOND },
  { i: 100001806, n: 'Sirius B', dNueva: 2.639219, fuente: BOND },
  { i: 1451193, n: 'Rigil Kentaurus', dNueva: 1.338382, fuente: KERVELLA },
  { i: 1451151, n: 'Toliman', dNueva: 1.338382, fuente: KERVELLA },
  { i: 700584, n: 'VY CMa', dNueva: 1200, fuente: ZHANG },
  { i: 463434, n: 'Betelgeuse', dNueva: 222, fuente: HARPER },
  { i: 435703, n: 'Alnitak', dNueva: 400, fuente: BRICENO },
  { i: 427355, n: 'Alnilam', dNueva: 400, fuente: BRICENO },
  { i: 419386, n: 'Mintaka', dNueva: 400, fuente: BRICENO },
];

// Estrellas famosas (famosas.js, build_famosas.js) cuya paralaje propia de Gaia DR3 no cumple la regla: distancia
// medida y publicada, por su Gaia DR3.
export const DISTANCIAS_FAMOSAS = {
  // RS Persei: miembro de NGC 884 en el UCC (probabilidad 0,827); Baron et al. 2014 la llaman «firmly established member».
  '458407464445792384': { n: 'RS Persei', dNueva: 1000 / 0.4009, fuente: `${UCC('NGC 884 (χ Persei)', '0,4009')}; pertenencia: Baron et al. 2014, ApJ 785, 46` },
  '2056188624872569088': { n: 'V404 Cygni', dNueva: 1000 / 0.418, fuente: 'Miller-Jones et al. 2009, ApJ 706, L230 (paralaje de radio VLBI, 0,418 ± 0,024 mas)' },
  '2065235853217670656': { n: 'NML Cygni', dNueva: 1000 / 0.620, fuente: 'Zhang et al. 2012, A&A 544, A42 (paralaje de máseres de agua con VLBA, 0,620 ± 0,047 mas)' },
  '5940106041452150272': { n: 'Westerlund 1-26', dNueva: 1000 / 0.238, fuente: 'Negueruela et al. 2022, A&A 664, A146 (paralaje del cúmulo Westerlund 1 con Gaia EDR3 y punto cero corregido, 0,238 ± 0,012 mas); Gaia DR3 de W26: Navarete et al. 2022, tabla A1' },
  // Gaia BH1 y BH2: paralaje de la solución orbital de Gaia DR3 (gaiadr3.nss_two_body_orbit).
  '4373465352415301632': { n: 'Gaia BH1', dNueva: 1000 / 2.0954515888832432, fuente: 'Gaia DR3, solución orbital (nss_two_body_orbit): 2,0955 ± 0,0175 mas; El-Badry et al. 2023, MNRAS 518, 1057' },
  '5870569352746779008': { n: 'Gaia BH2', dNueva: 1000 / 0.8591918579064037, fuente: 'Gaia DR3, solución orbital AstroSpectroSB1 (nss_two_body_orbit): 0,8592 ± 0,0183 mas; El-Badry et al. 2023, MNRAS 521, 4323' },
  '4318465066420528000': { n: 'Gaia BH3', dNueva: 1000 / 1.6933, fuente: 'Gaia Collaboration, Panuzzo et al. 2024, A&A 686, L2 (paralaje de la solución orbital previa a DR4, 1,6933 ± 0,0164 mas)' },
  '3107789548859766016': { n: 'V838 Monocerotis', dNueva: 6100, fuente: 'Sparks et al. 2008, AJ 135, 605, arXiv:0711.1495 (eco de luz polarizado, 6,1 ± 0,6 kpc)' },
  // Dust-Ball (V927 Per): miembro de IC 348 en el UCC (probabilidad 1); su paralaje propia falla por RUWE 2,40.
  '216708248573262208': { n: 'Dust-Ball', dNueva: 1000 / 3.1721, fuente: UCC('IC 348', '3,1721') },
};
