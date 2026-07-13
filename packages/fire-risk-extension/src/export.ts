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
  return {
    format: 'pascal-scene',
    pascalVersion: PASCAL_EDITOR_VERSION,
    fireRiskMetadataVersion: '0.1',
    scene: { nodes, rootNodeIds },
  }
}

export function downloadFireRiskScene(
  nodes: Record<string, unknown>,
  rootNodeIds: string[],
): void {
  const payload = buildFireRiskSceneExport(nodes, rootNodeIds)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'building.pascal.json'
  link.click()
  URL.revokeObjectURL(url)
}
