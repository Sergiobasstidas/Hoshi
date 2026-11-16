import { useEffect, useRef, useState } from 'react';
import { Dato } from './FichaLateral';
import { anoActual, anomaliaEn, cruces, escalas, proximoPaso, relativa, velocidadRelativa } from './scene/orbitasPar';
import './orbitasPar.css';
import { colorCatalogo } from './scene/visualBinary';

const SEGUNDOS_POR_VUELTA = 24, ANOS_RASTRO = 9;
const BASE = { centro: [143, 179, 255], fg: [231, 234, 240], tenue: [139, 148, 167] };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const decimal = (valor, digitos = 1) => valor.toLocaleString('es-CL', { minimumFractionDigits: digitos, maximumFractionDigits: digitos });
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesYAno = ano => `${MESES[Math.min(11, Math.floor((ano % 1) * 12))]} de ${Math.floor(ano)}`;

// Fondo de estrellas fijo (semilla determinista).
const FONDO = (() => {
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  return Array.from({ length: 110 }, () => ({ x: azar(), y: azar(), r: azar() < 0.9 ? 1 : 1.6, a: 0.12 + azar() * 0.35 }));
})();

// Dibuja el par en un lienzo 2D. Solo anima mientras el tiempo corre o hay una transición en curso.
function crearAnimacion(canvas, lecturas, orbita, estado) {
  const COLOR = { ...BASE, primaria: colorCatalogo(orbita.primaria.star), companera: colorCatalogo(orbita.companera.star) };
  // Dirección suavizada de cada rótulo: sigue a su estrella sin saltos.
  const direcciones = {};
  let dtCuadro = 0;
  const ctx = canvas.getContext('2d');
  estado.q = estado.qMeta;
  let vista = null, vertical = false, ultimo = performance.now(), pedido = 0, cache = { q: null, puntos: [] };
  const fuente = getComputedStyle(canvas).fontFamily;

  const rotar = ([x, y]) => vertical ? [-y, -x] : [x, -y];
  const encuadre = (W, H, s) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i <= 120; i++) {
      const r = relativa(orbita, i / 120 * 2 * Math.PI);
      for (const f of [s.primaria, s.companera, s.centro]) {
        const [x, y] = rotar([r[0] * f, r[1] * f]);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
    const margen = Math.max(30, Math.min(W, H) * 0.1);
    return { sc: Math.min((W - 2 * margen) / Math.max(x1 - x0, 1e-6), (H - 2 * margen) / Math.max(y1 - y0, 1e-6)), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  function curva(S, f, color, ancho, guiones) {
    if (Math.abs(f) < 1e-4) return;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const r = relativa(orbita, i / 200 * 2 * Math.PI), p = S([r[0] * f, r[1] * f]);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    ctx.setLineDash(guiones || []); ctx.strokeStyle = color; ctx.lineWidth = ancho; ctx.stroke(); ctx.setLineDash([]);
  }
  function rastro(S, f, color) {
    if (Math.abs(f) < 1e-3) return;
    const n = 40;
    let antes = null;
    for (let i = 0; i <= n; i++) {
      const r = relativa(orbita, anomaliaEn(orbita, estado.t - ANOS_RASTRO * (1 - i / n))), p = S([r[0] * f, r[1] * f]);
      if (antes) {
        ctx.strokeStyle = rgba(color, 0.9 * Math.pow(i / n, 1.7)); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(antes[0], antes[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      }
      antes = p;
    }
  }
  function estrella(p, color, radio) {
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], radio * 4);
    g.addColorStop(0, rgba(color, 0.55)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], radio * 4, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = rgba(color, 0.9); ctx.beginPath(); ctx.arc(p[0], p[1], radio, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(p[0], p[1], radio * 0.55, 0, 2 * Math.PI); ctx.fill();
  }
  // Dirección unitaria suavizada en el tiempo; si la nueva es casi nula se conserva la anterior.
  function suavizar(clave, dx, dy, inicial) {
    const previa = direcciones[clave] || inicial;
    const l = Math.hypot(dx, dy);
    const meta = l > 1e-6 ? [dx / l, dy / l] : previa;
    const f = direcciones[clave] ? 1 - Math.exp(-dtCuadro * 6) : 1;
    let x = previa[0] + (meta[0] - previa[0]) * f, y = previa[1] + (meta[1] - previa[1]) * f;
    const n = Math.hypot(x, y) || 1;
    return (direcciones[clave] = [x / n, y / n]);
  }
  // Rótulo junto a su estrella, del lado opuesto a `desde`. El anclaje es continuo: el texto se
  // desplaza poco a poco de un lado a otro de la estrella en vez de saltar.
  function etiqueta(texto, p, desde, color, W, H) {
    const [dx, dy] = suavizar(texto, p[0] - desde[0], p[1] - desde[1], [0, -1]);
    ctx.font = `400 11px ${fuente}`;
    const ancho = ctx.measureText(texto).width;
    let x = p[0] + dx * 13 - ancho * (1 - dx) / 2, y = p[1] + dy * 13 + 4 + 4 * dy;
    x = Math.max(6, Math.min(W - ancho - 6, x)); y = Math.max(13, Math.min(H - 6, y));
    ctx.fillStyle = rgba(color, 0.95); ctx.fillText(texto, x, y);
  }
  function regla(W, H, sc) {
    const opciones = [[5, 'del Sol a Júpiter'], [10, 'del Sol a Saturno'], [20, 'del Sol a Urano']];
    let elegida = opciones[0];
    for (const o of opciones) if (o[0] * sc <= W * 0.3) elegida = o;
    const largo = elegida[0] * sc, x = 10, y = H - 12;
    ctx.strokeStyle = rgba(COLOR.tenue, 0.8); ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(x, y - 3); ctx.lineTo(x, y); ctx.lineTo(x + largo, y); ctx.lineTo(x + largo, y - 3); ctx.stroke();
    ctx.font = `400 9.5px ${fuente}`; ctx.fillStyle = rgba(COLOR.tenue, 0.95);
    ctx.fillText(`${elegida[0]} UA`, x, y - 6);
    ctx.fillStyle = rgba(COLOR.tenue, 0.7); ctx.fillText(elegida[1], x + largo + 6, y + 3);
  }

  function cuadro(ahora) {
    pedido = 0;
    const dt = Math.min(0.1, Math.max(0, (ahora - ultimo) / 1000)); ultimo = ahora; dtCuadro = dt;
    if (estado.andando) estado.t += dt * orbita.periodo / SEGUNDOS_POR_VUELTA;
    const falta = estado.kMeta - estado.kp;
    estado.kp += Math.sign(falta) * Math.min(dt / 0.9, Math.abs(falta));
    const k = estado.kp * estado.kp * (3 - 2 * estado.kp);
    estado.q += (estado.qMeta - estado.q) * (1 - Math.exp(-dt * 5));
    if (Math.abs(estado.qMeta - estado.q) < 1e-4) estado.q = estado.qMeta;

    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const eraVertical = vertical; vertical = H > W * 1.05;
    const s = escalas(k, estado.q), meta = encuadre(W, H, s);
    let quieto = true;
    if (!vista || eraVertical !== vertical) vista = meta;
    else {
      const f = 1 - Math.exp(-dt * 7);
      vista = { sc: vista.sc + (meta.sc - vista.sc) * f, cx: vista.cx + (meta.cx - vista.cx) * f, cy: vista.cy + (meta.cy - vista.cy) * f };
      quieto = Math.abs(meta.sc - vista.sc) / meta.sc < 1e-3 && Math.hypot(meta.cx - vista.cx, meta.cy - vista.cy) * meta.sc < 0.3;
    }
    const v = vista;
    const S = p => { const [x, y] = rotar(p); return [W / 2 + (x - v.cx) * v.sc, H / 2 + (y - v.cy) * v.sc]; };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const e of FONDO) { ctx.fillStyle = rgba(COLOR.fg, e.a); ctx.fillRect(e.x * W, e.y * H, e.r, e.r); }

    curva(S, s.companera, rgba(COLOR.companera, 0.4), 1);
    curva(S, s.primaria, rgba(COLOR.primaria, 0.4), 1);
    if (k > 0.02) curva(S, s.centro, rgba(COLOR.centro, 0.45 * k), 1, [3, 4]);
    if (k < 0.02) {
      if (cache.q !== estado.q) cache = { q: estado.q, puntos: cruces(orbita, estado.q) };
      ctx.strokeStyle = rgba(COLOR.fg, 0.5); ctx.lineWidth = 1;
      for (const c of cache.puntos) { const p = S(c); ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 2 * Math.PI); ctx.stroke(); }
    }
    rastro(S, s.companera, COLOR.companera);
    rastro(S, s.primaria, COLOR.primaria);

    const E = anomaliaEn(orbita, estado.t), r = relativa(orbita, E);
    const pP = S([r[0] * s.primaria, r[1] * s.primaria]), pC = S([r[0] * s.companera, r[1] * s.companera]), pM = S([r[0] * s.centro, r[1] * s.centro]);
    ctx.setLineDash([2, 5]); ctx.strokeStyle = rgba(COLOR.fg, 0.28); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pP[0], pP[1]); ctx.lineTo(pC[0], pC[1]); ctx.stroke(); ctx.setLineDash([]);

    // Centro de masa: cruz fina y su nombre al costado de la recta que une a las estrellas.
    ctx.strokeStyle = rgba(COLOR.centro, 0.95); ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(pM[0] - 6, pM[1]); ctx.lineTo(pM[0] + 6, pM[1]); ctx.moveTo(pM[0], pM[1] - 6); ctx.lineTo(pM[0], pM[1] + 6); ctx.stroke();
    // Normal a la recta entre las estrellas, del lado más cercano a la que tenía (sin voltear de golpe).
    let nx = -(pC[1] - pP[1]), ny = pC[0] - pP[0];
    const previa = direcciones['centro de masa'] || [0, 1];
    if (nx * previa[0] + ny * previa[1] < 0) { nx = -nx; ny = -ny; }
    [nx, ny] = suavizar('centro de masa', nx, ny, [0, 1]);
    ctx.font = `400 9.5px ${fuente}`;
    const tc = 'centro de masa', wc = ctx.measureText(tc).width;
    ctx.fillStyle = rgba(COLOR.centro, 0.9);
    ctx.fillText(tc, Math.max(6, Math.min(W - wc - 6, pM[0] + nx * 15 - wc * (1 - nx) / 2)), Math.max(12, Math.min(H - 6, pM[1] + ny * 15 + 4 + 3 * ny)));

    estrella(pC, COLOR.companera, 4.5);
    estrella(pP, COLOR.primaria, 5.5);
    const enCentro = Math.hypot(pP[0] - pM[0], pP[1] - pM[1]) < 2;
    etiqueta(orbita.companera.nombre, pC, pM, COLOR.companera, W, H);
    etiqueta(orbita.primaria.nombre, pP, enCentro ? pC : pM, COLOR.primaria, W, H);
    regla(W, H, v.sc);

    const l = lecturas;
    if (l.ano) l.ano.textContent = String(Math.floor(estado.t));
    if (l.sep) l.sep.textContent = `${decimal(Math.hypot(r[0], r[1]))} UA`;
    if (l.vel) l.vel.textContent = `${decimal(velocidadRelativa(orbita, E))} km/s`;

    const enTransicion = Math.abs(estado.kMeta - estado.kp) > 0 || estado.q !== estado.qMeta || !quieto;
    if (estado.andando || enTransicion) pedido = requestAnimationFrame(cuadro);
  }
  const despertar = () => { if (!pedido) { ultimo = performance.now(); pedido = requestAnimationFrame(cuadro); } };
  despertar();
  const observador = new ResizeObserver(despertar);
  observador.observe(canvas);
  return {
    actuar: cambio => { cambio(estado); despertar(); },
    detener: () => { cancelAnimationFrame(pedido); observador.disconnect(); },
  };
}

function Opciones({ titulo, opciones, activa, onElegir }) {
  return <div className="orbitas-grupo" role="group" aria-label={titulo}>
    <h3>{titulo}</h3>
    <ul className="ficha-estrella-planetas">
      {opciones.map(([clave, texto]) => <li key={clave}>
        <button aria-pressed={activa === undefined ? undefined : activa === clave} onClick={() => onElegir(clave)}>{texto}</button>
      </li>)}
    </ul>
  </div>;
}

// Página de la ficha con las órbitas de un par: en torno al centro de masa o desde la primaria.
export default function OrbitasPar({ orbita, onVolver, nombreVolver }) {
  const lienzo = useRef(null), lecturas = useRef({}), animacion = useRef(null);
  const [andando, setAndando] = useState(() => !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [vista, setVista] = useState('centro');
  const [masas, setMasas] = useState('reales');
  const [m1, m2] = orbita.masas, { primaria, companera } = orbita;
  const Q = { reales: m2 / (m1 + m2), iguales: 0.5, diez: 1 / 11 };
  // La animación se crea una vez por par; los botones le cambian el estado sin volver a renderizar el lienzo.
  useEffect(() => {
    const creada = crearAnimacion(lienzo.current, lecturas.current, orbita, { t: anoActual(), andando, kp: 0, kMeta: 0, qMeta: m2 / (m1 + m2) });
    animacion.current = creada;
    return () => { creada.detener(); animacion.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el estado inicial se toma solo al crearla
  }, [orbita]);

  const hoy = anoActual(), cerca = proximoPaso(orbita, hoy), lejos = proximoPaso(orbita, hoy, orbita.periodo / 2);
  const rp = orbita.a * (1 - orbita.e), ra = orbita.a * (1 + orbita.e);
  const actuar = cambio => animacion.current?.actuar(cambio);
  const ir = ano => { actuar(e => { e.t = ano; e.andando = false; }); setAndando(false); };

  return <>
    {onVolver && <button className="ficha-estrella-volver" onClick={onVolver}>← {nombreVolver}</button>}
    <h2 className="marca-hoshi">Órbitas</h2>
    <p className="ficha-estrella-tipo">{primaria.nombre} y {companera.nombre}</p>
    <p className="ficha-estrella-relato">{primaria.nombre} y {companera.nombre} giran en torno al mismo punto, su centro de masa, y dan una vuelta cada {decimal(orbita.periodo)} años.</p>
    <div className="orbitas-lienzo">
      <canvas ref={lienzo} role="img" aria-label={`${primaria.nombre} y ${companera.nombre} recorren dos elipses que comparten un foco: el centro de masa, que siempre queda entre las dos.`} />
    </div>
    <dl>
      <Dato etiqueta="Año"><span ref={el => { lecturas.current.ano = el; }} /></Dato>
      <Dato etiqueta="Separación"><span ref={el => { lecturas.current.sep = el; }} /></Dato>
      <Dato etiqueta="Velocidad entre ellas"><span ref={el => { lecturas.current.vel = el; }} /></Dato>
    </dl>
    <div className="orbitas-controles">
      <button className="ficha-estrella-accion" onClick={() => { const sigue = !andando; actuar(e => { e.andando = sigue; }); setAndando(sigue); }}>{andando ? 'Pausa' : 'Seguir'}</button>
      <Opciones titulo="Ir a" opciones={[['hoy', 'Hoy'], ['cerca', `Más cerca · ${Math.floor(cerca)}`], ['lejos', `Más lejos · ${Math.floor(lejos)}`]]}
        onElegir={clave => ir({ hoy: anoActual(), cerca, lejos }[clave])} />
      <Opciones titulo="Vista" opciones={[['centro', 'Centro de masa'], ['primaria', `Desde ${primaria.nombre}`]]} activa={vista}
        onElegir={clave => { actuar(e => { e.kMeta = clave === 'centro' ? 0 : 1; }); setVista(clave); }} />
      <Opciones titulo="Masas" opciones={[['reales', 'Reales'], ['iguales', 'Iguales'], ['diez', `${primaria.nombre} ×10`]]} activa={masas}
        onElegir={clave => { actuar(e => { e.qMeta = Q[clave]; }); setMasas(clave); }} />
    </div>
    <section>
      <h3>Cómo se mueven</h3>
      <ul className="ficha-lista">
        <li>Las dos estrellas giran en torno al centro de masa y siempre quedan en lados opuestos de ese punto, sobre la misma recta.</li>
        <li>Cada elipse es la misma órbita a otro tamaño. La de {primaria.nombre} es más chica porque tiene más masa; con masas iguales serían idénticas.</li>
        <li>Las elipses se cruzan en los círculos chicos, pero no pueden chocar: cuando una estrella pasa por un cruce, la otra está al otro lado del centro de masa.</li>
        <li>Vista desde {primaria.nombre}, {companera.nombre} recorre una sola elipse con {primaria.nombre} en un foco. Es la órbita que publican los catálogos.</li>
        <li>En el acercamiento máximo se mueven {decimal(velocidadRelativa(orbita, 0) / velocidadRelativa(orbita, Math.PI), 1)} veces más rápido que cuando están más lejos.</li>
      </ul>
    </section>
    <section>
      <h3>Órbita</h3>
      <dl>
        <Dato etiqueta="Período" valor={`${decimal(orbita.periodo)} años`} />
        <Dato etiqueta="Excentricidad" valor={decimal(orbita.e, 2)} />
        <Dato etiqueta="Distancia media" valor={`${decimal(orbita.a)} UA`} />
        <Dato etiqueta="Más cerca" valor={`${decimal(rp)} UA`} secundario={mesYAno(cerca)} />
        <Dato etiqueta="Más lejos" valor={`${decimal(ra)} UA`} secundario={String(Math.floor(lejos))} />
        <Dato etiqueta="Masas" valor={`${decimal(m1, 2)} y ${decimal(m2, 2)} M☉`} />
        <Dato etiqueta="1 UA" valor="Distancia de la Tierra al Sol" />
      </dl>
    </section>
    <p className="ficha-estrella-fuente">Datos: {orbita.fuente}</p>
  </>;
}
