import { useEffect, useState } from 'react';
import { filtroPorId } from './scene/filtroEstelar';
import { SDO_CHANNELS, SDO_CREDIT, SDO_SOURCE, sdoChannelDate, sdoDateLabel, sdoState } from './scene/sdoSolar';
import './creditoSdo.css';

// Rótulo del filtro del Sol: el SDO solo ve la cara que mira a la Tierra, en la fecha de la imagen.
export default function CreditoSDO({ filtro }) {
  const { canal, instrumento, nombre } = filtroPorId(filtro);
  const [fecha, setFecha] = useState(null);
  // La fecha llega con sdo.json, y la del vídeo cuando empieza a reproducirse.
  useEffect(() => {
    if (!canal) return undefined;
    const check = () => setFecha(sdoChannelDate(canal) || null);
    check();
    const timer = setInterval(check, 500);
    return () => clearInterval(timer);
  }, [canal]);
  if (!canal) return null;
  const video = SDO_CHANNELS[canal].video && sdoState().video;
  return <div className="credito-sdo" role="note">
    <strong>Sol · {nombre} · {instrumento}</strong>
    <span>Vista desde la Tierra{fecha ? ` · ${video ? 'vídeo de las 48 h hasta el' : 'imagen del'} ${sdoDateLabel(fecha)}` : ''}</span>
    <span>La cara oculta es un reflejo en espejo de la visible, no una observación</span>
    <a href={SDO_SOURCE} target="_blank" rel="noreferrer">{SDO_CREDIT}</a>
  </div>;
}
