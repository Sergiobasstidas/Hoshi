// Viajes ordinarios: 8 segundos. Los demás destinos conservan su duración relativa.
// El ritmo es perceptual (distancia logarítmica), no una velocidad física constante.
export const JOURNEY_TIME_SCALE=1.6;
export const JOURNEY_SECONDS=5*JOURNEY_TIME_SCALE;
export const JOURNEY_ACCELERATION=0.22;
export const JOURNEY_DECELERATION=0.38;

// Integrar una curva suave de velocidad: salida corta, avance sostenido
// y llegada prolongada. Velocidad y aceleración coinciden en ambas uniones.
export function journeyProgress(progress) {
  const t=Math.max(0,Math.min(1,progress));
  const a=JOURNEY_ACCELERATION, d=JOURNEY_DECELERATION;
  const area=1-(a+d)/2;
  const integral=u=>u*u*u*(1-u/2);
  if(t<a)return a*integral(t/a)/area;
  if(t>1-d)return 1-d*integral((1-t)/d)/area;
  return (t-a/2)/area;
}
export function journeyDistance(start,end,progress) {
  const eased=journeyProgress(progress);
  return Math.exp(Math.log(start)*(1-eased)+Math.log(end)*eased);
}
