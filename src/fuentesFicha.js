// Fuentes de «Datos:» de la ficha de una estrella, sin repetir: si una empieza con otra (la misma cita con el detalle del
// cálculo, como el radio de VY CMa o de UY Scuti), queda solo la más larga.
export const fuentesSinRepetir = fuentes => [...new Set(fuentes)].filter(fuente => !fuentes.some(otra => otra !== fuente && otra.startsWith(fuente)));
