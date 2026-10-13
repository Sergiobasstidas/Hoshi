// Lectura de designaciones de componentes de ORB6 y WDS, compartida con las pruebas.
// Componentes de un par: «AB» → A y B; «Aa,Ab» → Aa y Ab; «AB,C» → AB y C; vacío → A y B.
export function parseComponents(text) {
  const value = text.replace(/\s+/g, '');
  if (!value) return ['A', 'B'];
  if (!/^[A-Za-z,]+$/.test(value)) return null;
  if (value.includes(',')) {
    const parts = value.split(',');
    return parts.length === 2 && parts.every(Boolean) ? parts : null;
  }
  return /^[A-Z]{2}$/.test(value) ? [value[0], value[1]] : null;
}
