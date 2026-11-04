// Supergigantes brillantes cuya paralaje de Hipparcos falla (saturan a Gaia): distancia medida y publicada,
// por paralaje de máseres o de radio, o la de su asociación medida con Gaia. Por ID de AT-HYG; la aplica
// catalog_patches.js después de las correcciones de Gaia DR3.
const ZHANG = 'Zhang et al. 2012, ApJ 744, 23 (paralaje de máser SiO, 0,83 ± 0,08 mas)';
const HARPER = 'Harper et al. 2017, AJ 154, 11 (radio con Hipparcos, 4,51 ± 0,80 mas)';
const BRICENO = 'Briceño et al. 2019, AJ 157, 85, arXiv:1805.01008 (Orión OB1b con Gaia DR2)';

export const DISTANCIAS_CURADAS = [
  { i: 700584, n: 'VY CMa', dNueva: 1200, fuente: ZHANG },
  { i: 463434, n: 'Betelgeuse', dNueva: 222, fuente: HARPER },
  { i: 435703, n: 'Alnitak', dNueva: 400, fuente: BRICENO },
  { i: 427355, n: 'Alnilam', dNueva: 400, fuente: BRICENO },
  { i: 419386, n: 'Mintaka', dNueva: 400, fuente: BRICENO },
];
