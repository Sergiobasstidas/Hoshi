import { Dato } from './FichaLateral';

const numero = (valor, digitos = 3) => valor.toLocaleString('es-CL', { maximumSignificantDigits: digitos });
const JUPITER_RADIOS_TIERRA = 11.2;
const ORBITAS_SOLARES = [['Mercurio', 0.387], ['Venus', 0.723], ['la Tierra', 1], ['Marte', 1.524], ['Júpiter', 5.2], ['Saturno', 9.58], ['Urano', 19.2], ['Neptuno', 30.1]];

function clasePlaneta(radio) {
  if (radio < 1.25) return ['Planeta rocoso', 'Un mundo de roca, de un tamaño parecido al nuestro. Son los más difíciles de encontrar: apenas ensombrecen a su estrella cuando pasan frente a ella.'];
  if (radio < 2) return ['Supertierra', 'Más grande que la Tierra y más pequeño que Neptuno: una clase de mundo que no existe en nuestro sistema solar, y sin embargo es de las más comunes de la galaxia.'];
  if (radio < 6) return ['Tipo Neptuno', 'Un mundo envuelto en una atmósfera espesa de gases, con un interior que aún no podemos ver. Si estuviera en nuestro cielo, sería un gigante entre los planetas interiores.'];
  return ['Gigante gaseoso', 'Una inmensa esfera de hidrógeno y helio, sin una superficie donde posarse. Dentro de un planeta así cabrían cientos o miles de Tierras.'];
}
const duracionAno = dias => dias < 2 ? `${numero(dias * 24)} horas` : dias < 730 ? `${numero(dias)} días` : `${numero(dias / 365.25)} años`;
function distanciaComparada(ua) {
  const [cuerpo, orbita] = ORBITAS_SOLARES.reduce((a, b) => Math.abs(Math.log(b[1] / ua)) < Math.abs(Math.log(a[1] / ua)) ? b : a);
  const razon = ua / orbita;
  if (razon > 0.85 && razon < 1.18) return `Casi la misma que ${cuerpo} al Sol`;
  return razon < 1 ? `${numero(1 / razon, 2)} veces más cerca que ${cuerpo} del Sol` : `${numero(razon, 2)} veces más lejos que ${cuerpo} del Sol`;
}
// Tamaño comparado con la Tierra y Júpiter, a la misma escala.
function ComparacionPlaneta({ radio, color }) {
  const escala = 30 / Math.max(radio, JUPITER_RADIOS_TIERRA);
  const circulos = [['Tierra', 1, '#6ea8d8'], ['Este planeta', radio, color], ['Júpiter', JUPITER_RADIOS_TIERRA, '#d9b48a']];
  const texto = radio >= 1 ? `${numero(radio)} veces el radio de la Tierra` : `${numero(1 / radio)} veces más pequeño que la Tierra`;
  return <figure className="ficha-estrella-comparacion">
    <svg viewBox="0 0 200 70" role="img" aria-label={texto}>
      {circulos.map(([nombre, valor, relleno], i) => <circle key={nombre} cx={[30, 90, 160][i]} cy={35} r={Math.max(1.2, valor * escala)} fill={relleno} />)}
    </svg>
    <figcaption className="tres"><span>Tierra</span><span>Este planeta</span><span>Júpiter</span></figcaption>
    <p>{texto}</p>
  </figure>;
}

export default function FichaPlaneta({ planeta, sistema, nombreEstrella, volver, onVerEstrella, onVerPlaneta }) {
  const [tipo, relato] = clasePlaneta(planeta.r);
  const hermanos = sistema.planets.filter(otro => otro.n !== planeta.n);
  const excentrica = planeta.e >= 0.3;
  return <>
    {volver && <button className="ficha-estrella-volver" onClick={onVerEstrella}>‹ {nombreEstrella}</button>}
    <h2 className="marca-hoshi">{planeta.n}</h2>
    <p className="ficha-estrella-tipo">{tipo}</p>
    <p className="ficha-estrella-relato">{relato}</p>
    <ComparacionPlaneta radio={planeta.r} color={`rgb(${planeta.color.map(v => Math.round(v * 255)).join(', ')})`} />
    <dl>
      <Dato etiqueta="Radio" valor={`${numero(planeta.r)} Tierras`} />
      {planeta.m > 0 && <Dato etiqueta="Masa" valor={`${numero(planeta.m)} Tierras`} />}
      {planeta.P > 0 && <Dato etiqueta="Su año dura" valor={duracionAno(planeta.P)} />}
      {planeta.a > 0 && <Dato etiqueta="Distancia a su estrella" valor={`${numero(planeta.a)} UA`} />}
      {planeta.teq > 0 && <Dato etiqueta="Temperatura" valor={`${Math.round(planeta.teq).toLocaleString('es-CL')} K`} secundario={`${Math.round(planeta.teq - 273.15).toLocaleString('es-CL')} °C`} />}
    </dl>
    {planeta.a > 0 && <p className="ficha-estrella-relato">{distanciaComparada(planeta.a)}.{excentrica ? ' Su órbita es muy alargada: pasa de acercarse mucho a su estrella a alejarse de ella.' : ''}</p>}
    {!volver && <button className="ficha-estrella-enlace" onClick={onVerEstrella}>Ver su estrella: {nombreEstrella}</button>}
    {hermanos.length > 0 && <section>
      <h3>{hermanos.length === 1 ? 'Otro planeta del sistema' : `Otros ${hermanos.length} planetas del sistema`}</h3>
      <ul className="ficha-estrella-planetas">
        {hermanos.slice(0, 12).map(otro => <li key={otro.n}>
          {otro.body ? <button onClick={() => onVerPlaneta(otro.body)}>{otro.n}</button> : <span>{otro.n}</span>}
        </li>)}
      </ul>
    </section>}
    <p className="ficha-estrella-fuente">Órbitas y tamaños a escala · <a href={'https://exoplanetarchive.ipac.caltech.edu/'} target="_blank" rel="noreferrer">NASA Exoplanet Archive</a></p>
  </>;
}
