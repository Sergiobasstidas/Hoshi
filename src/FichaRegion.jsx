// Fichas de las regiones del entorno solar que se eligen en «Viajar a» o con su nombre en la escena:
// el cinturón de Kuiper, la nube de Oort y las estrellas cercanas. Mismo formato que la ficha de la
// heliosfera (FichaHeliosfera.jsx). Solo valores publicados por la NASA, la ESA o en Wikipedia.
const REGIONES = {
  kuiper: {
    titulo: 'Cinturón de Kuiper',
    relato: 'Un disco de cuerpos helados más allá de la órbita de Neptuno, restos de la formación del sistema solar. De aquí vienen muchos de los cometas de período corto.',
    secciones: [
      ['Dónde', ['Entre unas 30 y 50 UA del Sol, más allá de Neptuno.']],
      ['Quiénes', ['Plutón, descubierto por Clyde Tombaugh en 1930; Haumea, Makemake y Arrokoth, entre muchos otros.',
        'Albión (1992 QB1), descubierto en 1992 por David Jewitt y Jane Luu, fue el primero después de Plutón.']],
      ['Visitas', ['New Horizons pasó junto a Plutón el 14 de julio de 2015 y junto a Arrokoth el 1 de enero de 2019, el objeto más lejano visitado por una nave.']],
    ],
  },
  oort: {
    titulo: 'Nube de Oort',
    relato: 'Una capa esférica de cuerpos helados que envuelve al sistema solar y marca el límite de la gravedad del Sol. Nunca se ha observado directamente: se conoce por los cometas de período largo que llegan desde ella.',
    secciones: [
      ['Dónde', ['El borde interior, entre 2.000 y 5.000 UA del Sol; el exterior, entre 10.000 y 100.000 UA.']],
      ['Origen de la idea', ['Jan Oort la propuso en 1950 para explicar de dónde vienen los cometas de período largo.']],
      ['Las sondas', ['A la Voyager 1 le faltan unos 300 años para llegar a su borde interior y cerca de 30.000 para atravesarla.']],
    ],
  },
  stars: {
    titulo: 'Estrellas cercanas',
    relato: 'El vecindario del Sol en la Vía Láctea: las estrellas más próximas están a pocos años luz y casi todas son enanas rojas, demasiado débiles para verse a simple vista.',
    secciones: [
      ['Las más próximas', ['Próxima Centauri, a 4,24 años luz, descubierta por Robert Innes en 1915. Tiene un planeta en su zona habitable, Próxima Centauri b, descubierto en 2016.',
        'Alfa Centauri A y B, a 4,37 años luz, la pareja que forma con Próxima el sistema más cercano.',
        'La estrella de Barnard, a 5,96 años luz, la más cercana después del sistema de Alfa Centauri.']],
      ['La más brillante', ['Sirio, a 8,6 años luz, la estrella más brillante del cielo nocturno.']],
    ],
  },
};

export default function FichaRegion({ region, onCerrar }) {
  const datos = REGIONES[region];
  return <aside className="pulsar-legend ficha-heliosfera" aria-label={`Información de ${datos.titulo}`}>
    <button className="panel-close" aria-label="Cerrar información" onClick={onCerrar}>×</button>
    <strong>{datos.titulo}</strong>
    <span>{datos.relato}</span>
    {datos.secciones.map(([titulo, lineas]) => [
      <span key={titulo} className="ficha-titulo">{titulo}</span>,
      ...lineas.map(linea => <span key={linea}>{linea}</span>),
    ])}
  </aside>;
}
