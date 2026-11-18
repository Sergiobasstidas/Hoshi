// Masas dinámicas medidas de cada estrella de un par con órbita (en masas solares), para animar su órbita en torno al
// centro de masa (OrbitasPar.jsx). Por el nombre del par en ORB6. Solo masas medidas y publicadas: las del catálogo de
// sistemas múltiples (MSC), que salen de la fotometría o de modelos, no se usan. Los pares sin masas medidas se animan
// como órbita relativa (la compañera en torno a la principal), que es lo que mide la órbita.
// Además de esta lista, star_systems.json trae masas medidas en dos casos (scripts/process_binaries.js): «pub», de
// scripts/published_binary_masses.js, y «sb9», con la razón de masas de una binaria espectroscópica de doble línea
// (K1/K2, catálogo SB9) y la masa total de la órbita visual.
export const MASAS_DINAMICAS = {
  // Alfa Centauri A y B: Akeson et al. 2021, AJ 162, 14 (tabla 6), 1,0788 ± 0,0029 y 0,9092 ± 0,0025 M☉.
  'RHD 1': [1.0788, 0.9092],
  // Sirio A y B: Bond et al. 2017, ApJ 840, 70, arXiv:1703.10625, 2,063 ± 0,023 y 1,018 ± 0,011 M☉.
  'AGC 1': [2.063, 1.018],
  // Proción A y B: Bond et al. 2015, ApJ 813, 106, arXiv:1510.00485, 1,478 ± 0,012 y 0,592 ± 0,006 M☉.
  'SHB 1': [1.478, 0.592],
  // 70 Ophiuchi A y B: Eggenberger et al. 2008, A&A 482, 631, arXiv:0802.3576 (tabla 1), 0,89 ± 0,02 y 0,73 ± 0,01 M☉:
  // masas de su ajuste de la órbita (velocidades radiales de HARPS y anteriores con las medidas de speckle), no de modelos.
  STF2272: [0.89, 0.73],
  // Eta Cassiopeiae A y B: Giovinazzi et al. 2025, AJ 170, 52, arXiv:2505.12563 (sección V.4), 1,0258 ± 0,007 y
  // 0,5487 ± 0,0056 M☉: masas dinámicas del ajuste de la órbita con velocidades radiales de NEID y astrometría.
  'STF 60': [1.0258, 0.5487],
};
