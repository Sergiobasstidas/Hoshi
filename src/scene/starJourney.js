// Shared by the body selector and star search: formerly three seconds in the selector.
export const JOURNEY_SECONDS=5;
export function journeyDistance(start,end,progress) {
  const t=Math.max(0,Math.min(1,progress));
  // Spread the visible departure over more of the flight, instead of spending
  // most of it already close to the destination. Keep a smooth zero-speed end.
  const paced = t * t;
  const eased=paced*paced*paced*(paced*(paced*6-15)+10);
  return Math.exp(Math.log(start)*(1-eased)+Math.log(end)*eased);
}
