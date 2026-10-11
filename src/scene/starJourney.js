// Ordinary trips: 8 seconds. Other destinations retain their relative duration.
// Timing is perceptual (log distance), not constant physical velocity.
export const JOURNEY_TIME_SCALE=1.6;
export const JOURNEY_SECONDS=5*JOURNEY_TIME_SCALE;
export const JOURNEY_ACCELERATION=0.22;
export const JOURNEY_DECELERATION=0.38;

// Integrate a smooth velocity envelope: shorter departure, sustained travel,
// then a longer arrival. Velocity and acceleration match at both joins.
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
