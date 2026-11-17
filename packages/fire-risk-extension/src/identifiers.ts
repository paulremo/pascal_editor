export function fireRiskIdFromName(name: unknown): string {
  return typeof name === 'string' ? name.trim().toLowerCase().replace(/\s+/g, '_') : ''
}
