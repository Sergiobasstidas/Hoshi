// Conserva orden y separación de las etiquetas presentes. Un nombre nuevo
// desplaza a uno anterior solo si está claramente más cerca de la cámara.
export function selectStarLabels(candidates, previous, selectedId, limit = 12) {
  const order = new Map([...previous].map((id, index) => [id, index]));
  const nearest = Math.min(...candidates.filter(c => !previous.has(c.id)).map(c => c.distance));
  const retained = c => previous.has(c.id) && !(nearest < c.distance * 0.65);
  const ranked = [...candidates].sort((a, b) => {
    const priority = c => c.id === selectedId ? 0 : c.hovered ? 1 : retained(c) ? 2 : 3;
    return priority(a) - priority(b)
      || (retained(a) && retained(b) ? order.get(a.id) - order.get(b.id) : a.distance - b.distance)
      || a.id - b.id;
  });
  const chosen = [];
  for (const candidate of ranked) {
    if (chosen.length >= limit) break;
    const gap = previous.has(candidate.id) ? 3 : 18;
    const overlap = chosen.some(other => candidate.x < other.x + other.width + gap
      && candidate.x + candidate.width + gap > other.x
      && Math.abs(candidate.y - other.y) < (previous.has(candidate.id) ? 18 : 28));
    if (!overlap || candidate.id === selectedId || candidate.hovered) chosen.push(candidate);
  }
  return new Set(chosen.map(c => c.id));
}
