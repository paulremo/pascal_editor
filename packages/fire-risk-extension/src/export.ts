import { fireRiskIdFromName } from './identifiers'

export const PASCAL_EDITOR_VERSION = 'c4580884'

export type FireRiskSceneExport = {
  format: 'pascal-scene'
  pascalVersion: string
  fireRiskMetadataVersion: '0.1'
  scene: {
    nodes: Record<string, unknown>
    rootNodeIds: string[]
  }
}

export function buildFireRiskSceneExport(
  nodes: Record<string, unknown>,
  rootNodeIds: string[],
): FireRiskSceneExport {
  const exportedNodes = { ...nodes }
  const identities = new Map<string, string[]>()
  const errors: string[] = []
  for (const [key, value] of Object.entries(nodes)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const node = value as Record<string, unknown>
    if (node.type !== 'zone' && node.type !== 'door') continue
    const id = fireRiskIdFromName(node.name)
    const kind = node.type === 'door' ? 'Door' : node.spaceRole === 'room' ? 'Room' : 'Zone'
    const label = `${kind} "${typeof node.name === 'string' ? node.name : ''}" (${key})`
    if (!id) {
      errors.push(`${label} needs a name to generate its fire-risk ID.`)
      continue
    }
    const matches = identities.get(id) ?? []
    matches.push(label)
    identities.set(id, matches)
    const metadata = asRecord(node.metadata)
    const { initialOpenFraction: _initialOpenFraction, ...fireRisk } = asRecord(metadata.fireRisk)
    exportedNodes[key] = {
      ...node,
      metadata: {
        ...metadata,
        fireRisk: {
          ...fireRisk,
          schemaVersion: '0.1',
          [node.type === 'door' ? 'openingId' : 'spaceId']: id,
        },
      },
    }
  }
  for (const [id, matches] of identities) {
    if (matches.length > 1) errors.push(`Duplicate fire-risk ID "${id}": ${matches.join('; ')}.`)
  }
  if (errors.length) {
    throw new Error(
      `Fire-risk export blocked:\n${errors.join('\n')}\nRename the rooms, zones or doors in the editor and export again.`,
    )
  }
  return {
    format: 'pascal-scene',
    pascalVersion: PASCAL_EDITOR_VERSION,
    fireRiskMetadataVersion: '0.1',
    scene: { nodes: exportedNodes, rootNodeIds },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function downloadFireRiskScene(nodes: Record<string, unknown>, rootNodeIds: string[]): void {
  const payload = buildFireRiskSceneExport(nodes, rootNodeIds)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'building.pascal.json'
  link.click()
  URL.revokeObjectURL(url)
}
