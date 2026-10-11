import { AU_TO_PC } from './scale.js';
import { BINARY_VIEW_DIRECTION } from './binaryOrbit.js';

// Cross-match: AT-HYG 2169831 = HIP 100287 = HD 193793 = WR 140.
// Keep the existing catalogue coordinates and photometry. See docs/WR140.md.
export const WR140_ID = 2169831;
export const WR140_NAME = 'Wolf-Rayet 140';

export function identifyStellarTargets(catalogue) {
  return catalogue.map(star => star.i === WR140_ID ? { ...star, n: WR140_NAME } : star);
}

export function stellarTargets(catalogue) {
  const star = catalogue.find(star => star.i === WR140_ID);
  if (!star) return [];
  return [{
    kind: 'system', name: WR140_NAME, catalogueId: star.i,
    position: [star.x, star.y, star.z], distancePc: star.d,
    identifiers: 'WR 140 · HD 193793 · HIP 100287',
    viewDistance: 80 * AU_TO_PC, minDistance: 0.2 * AU_TO_PC,
    viewDirection: BINARY_VIEW_DIRECTION,
    source: 'https://science.nasa.gov/asset/webb/wolf-rayet-140-miri/',
  }];
}
