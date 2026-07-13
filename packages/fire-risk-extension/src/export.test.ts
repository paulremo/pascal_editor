import { expect, test } from 'bun:test'
import { buildFireRiskSceneExport } from './export'

test('builds the documented Pascal scene envelope without changing nodes', () => {
  const nodes = {
    building_1: { id: 'building_1', type: 'building', metadata: {} },
    zone_1: { id: 'zone_1', type: 'zone', polygon: [[0, 0], [1, 0], [1, 1]] },
  }
  const exported = buildFireRiskSceneExport(nodes, ['building_1'])

  expect(exported.format).toBe('pascal-scene')
  expect(exported.pascalVersion).toBe('c4580884')
  expect(exported.fireRiskMetadataVersion).toBe('0.1')
  expect(exported.scene.nodes).toBe(nodes)
  expect(exported.scene.rootNodeIds).toEqual(['building_1'])
})
