import { filtroPorId } from './scene/filtroEstelar';
import './creditoSdo.css';

// Rótulo del filtro del Sol: qué muestra y, en las imágenes del SDO, que solo ve la cara que mira a la Tierra.
export default function CreditoSDO({ filtro }) {
  const { canal, instrumento, nombre, texto } = filtroPorId(filtro);
  return <div className="credito-sdo" role="status">
    <strong>Sol · {nombre}{instrumento ? ` · ${instrumento}` : ''}</strong>
    <span>{texto}</span>
    {canal && <span>La cara oculta es un reflejo en espejo de la visible, no una observación</span>}
  </div>;
}
