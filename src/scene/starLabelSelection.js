// Nearest on-screen names, with a preference for already visible labels.
// Hysteresis keeps small camera movements from constantly exchanging labels.
export function selectStarLabels(candidates, previous, selectedId, limit = 12) {
  const ranked = [...candidates].sort((a, b) => {
    const priority = c => c.id === selectedId ? 0 : c.hovered ? 1 : 2;
    return priority(a) - priority(b)
      || a.distance * (previous.has(a.id) ? 0.8 : 1) - b.distance * (previous.has(b.id) ? 0.8 : 1)
      || a.id - b.id;
  });
  const chosen = [];
  for (const candidate of ranked) {
    if (chosen.length >= limit) break;
    const overlap = chosen.some(other => candidate.x < other.x + other.width + 10
      && candidate.x + candidate.width + 10 > other.x
      && Math.abs(candidate.y - other.y) < 25);
    if (!overlap || candidate.id === selectedId || candidate.hovered) chosen.push(candidate);
  }
  return new Set(chosen.map(c => c.id));
}
