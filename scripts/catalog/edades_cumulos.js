// Edad de los cúmulos conocidos que dibuja Hoshi, como rango de estudios dedicados al cúmulo (aprobado por Sergio el
// 16/11/2026). Con un solo estudio, su valor central ± su incertidumbre; con varios, de la menor a la mayor de sus edades
// centrales. Los demás cúmulos toman el rango de los percentiles 16 y 84 de Hunt & Reffert 2023 (process_cumulos.js).
// Por el nombre del cúmulo en el UCC; en millones de años.

// Pléyades: límite del litio. Stauffer et al. 1998, ApJ 499, L199 (125 ± 8 Myr); Dahm 2015, ApJ 813, 108 (112 ± 5 Myr).
const PLEYADES = 'Stauffer et al. 1998, ApJ 499, L199 (límite del litio, 125 ± 8 Myr) y Dahm 2015, ApJ 813, 108 (límite del litio, 112 ± 5 Myr)';
// Híades: isócronas con Hipparcos, límite del litio e isócronas con rotación.
const HIADES = 'Perryman et al. 1998, A&A 331, 81 (isócronas, 625 ± 50 Myr), Martín et al. 2018, ApJ 856, 40 (límite del litio, 650 ± 70 Myr) y Brandt & Huang 2015, ApJ 807, 58 (isócronas con rotación, 750 ± 100 Myr)';
// Pesebre (Praesepe): isócronas con rotación.
const PESEBRE = 'Gossage et al. 2018, ApJ 863, 67 (isócronas con rotación, ~590 Myr) y Brandt & Huang 2015, ApJ 807, 58 (isócronas con rotación, 790 ± 60 Myr)';
// IC 2602: límite del litio. Dobbie, Lodieu & Sharp 2010, MNRAS 409, 1002 (46 +6/−5 Myr).
const IC2602 = 'Dobbie, Lodieu & Sharp 2010, MNRAS 409, 1002 (límite del litio, 46 +6/−5 Myr)';
// IC 2391: límite del litio. Barrado y Navascués, Stauffer & Jayawardhana 2004, ApJ 614, 386 (50 ± 5 Myr).
const IC2391 = 'Barrado y Navascués, Stauffer & Jayawardhana 2004, ApJ 614, 386 (límite del litio, 50 ± 5 Myr)';
// Alfa Persei: límite del litio. Stauffer et al. 1999, ApJ 527, 219 (90 ± 10 Myr); Galindo-Guil et al. 2022, A&A 664, A70 (75 ± 5 Myr).
const ALFA_PERSEI = 'Stauffer et al. 1999, ApJ 527, 219 (límite del litio, 90 ± 10 Myr) y Galindo-Guil et al. 2022, A&A 664, A70 (límite del litio, 75 ± 5 Myr)';
// NGC 2547: límite del litio. Jeffries & Oliveira 2005, MNRAS 358, 13 (34–36 Myr, con 10 % de precisión).
const NGC2547 = 'Jeffries & Oliveira 2005, MNRAS 358, 13 (límite del litio, 35 Myr ± 10 %)';
// Blanco 1: límite del litio. Juarez et al. 2014, ApJ 795, 143 (126 +13/−14 Myr; 114 +9/−10 Myr corrigiendo la actividad magnética).
const BLANCO1 = 'Juarez et al. 2014, ApJ 795, 143 (límite del litio, 126 +13/−14 Myr; 114 +9/−10 Myr con la actividad magnética)';

export const EDADES_CURADAS = {
  pleiades: { min: 112, max: 125, fuente: PLEYADES },
  hyades: { min: 625, max: 750, fuente: HIADES },
  ngc2632: { min: 590, max: 790, fuente: PESEBRE },
  ic2602: { min: 41, max: 52, fuente: IC2602 },
  ic2391: { min: 45, max: 55, fuente: IC2391 },
  melotte20: { min: 75, max: 90, fuente: ALFA_PERSEI },
  ngc2547: { min: 32, max: 38, fuente: NGC2547 },
  blanco1: { min: 114, max: 126, fuente: BLANCO1 },
};
