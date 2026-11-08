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

export const DISTANCIAS_CURADAS = [
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
