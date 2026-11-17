import { expect, spyOn, test } from 'bun:test'
import { buildFireRiskSceneExport, downloadFireRiskScene } from './export'

test('builds the documented Pascal scene envelope without changing nodes', () => {
  const nodes = {
    building_1: { id: 'building_1', type: 'building', metadata: {} },
    zone_1: {
      id: 'zone_1',
      type: 'zone',
      name: 'Room 7',
      polygon: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    },
  }
  const before = structuredClone(nodes)
  const exported = buildFireRiskSceneExport(nodes, ['building_1'])

  expect(exported.format).toBe('pascal-scene')
  expect(exported.pascalVersion).toBe('c4580884')
  expect(exported.fireRiskMetadataVersion).toBe('0.1')
  expect(exported.scene.nodes.building_1).toBe(nodes.building_1)
  expect(exported.scene.nodes.zone_1).toEqual({
    ...nodes.zone_1,
    metadata: { fireRisk: { schemaVersion: '0.1', spaceId: 'room_7' } },
  })
  expect(nodes).toEqual(before)
  expect(exported.scene.rootNodeIds).toEqual(['building_1'])
})

test('materializes current names and preserves annotations while omitting legacy initial open fractions', () => {
  const nodes = {
    zone_1: {
      type: 'zone',
      name: 'Room 7',
      metadata: {
        other: 'retained',
        fireRisk: { spaceId: 'old', usage: 'Office', includeInCfast: false },
      },
    },
    zone_2: { type: 'zone', name: 'Custom Area' },
    door_1: {
      type: 'door',
      name: 'Main Exit',
      metadata: { fireRisk: { openingId: 'old', finalExit: true, initialOpenFraction: 0.5 } },
    },
  }
  const before = structuredClone(nodes)
  const exported = buildFireRiskSceneExport(nodes, []).scene.nodes
  expect(exported.zone_1).toEqual({
    ...nodes.zone_1,
    metadata: {
      other: 'retained',
      fireRisk: { ...nodes.zone_1.metadata.fireRisk, schemaVersion: '0.1', spaceId: 'room_7' },
    },
  })
  expect(exported.zone_2).toEqual({
    ...nodes.zone_2,
    metadata: { fireRisk: { schemaVersion: '0.1', spaceId: 'custom_area' } },
  })
  expect(exported.door_1).toEqual({
    ...nodes.door_1,
    metadata: {
      fireRisk: { schemaVersion: '0.1', openingId: 'main_exit', finalExit: true },
    },
  })
  expect(nodes).toEqual(before)
})

test.each(['zone', 'door'])(
  'blocks duplicate %s IDs across the entire scene after normalizing names',
  (type) => {
    const nodes = {
      first: { type, name: ' Room 7 ', parentId: 'level_1' },
      second: { type, name: 'ROOM\t7', parentId: 'level_2' },
    }
    expect(() => buildFireRiskSceneExport(nodes, [])).toThrow('Duplicate fire-risk ID "room_7"')
    try {
      buildFireRiskSceneExport(nodes, [])
    } catch (error) {
      expect((error as Error).message).toContain('(first)')
      expect((error as Error).message).toContain('(second)')
    }
  },
)

test('space IDs and door IDs cannot collide with each other', () => {
  expect(() =>
    buildFireRiskSceneExport(
      {
        zone_1: { type: 'zone', name: 'Lobby' },
        door_1: { type: 'door', name: 'Lobby' },
      },
      [],
    ),
  ).toThrow('Duplicate fire-risk ID "lobby"')
})

test('reports all duplicate IDs in one export attempt', () => {
  expect(() =>
    buildFireRiskSceneExport(
      {
        zone_1: { type: 'zone', name: 'Room 1' },
        zone_2: { type: 'zone', name: 'Room_1' },
        door_1: { type: 'door', name: 'Door 1' },
        door_2: { type: 'door', name: 'door_1' },
      },
      [],
    ),
  ).toThrow(/Duplicate fire-risk ID "room_1"[\s\S]*Duplicate fire-risk ID "door_1"/)
})

test.each(['zone', 'door'])('blocks an unnamed %s instead of exporting an empty ID', (type) => {
  expect(() => buildFireRiskSceneExport({ unnamed: { type, name: '   ' } }, [])).toThrow(
    'needs a name',
  )
})

test('refuses a download before creating a browser download URL', () => {
  const createObjectURL = spyOn(URL, 'createObjectURL')
  try {
    expect(() =>
      downloadFireRiskScene(
        {
          zone_1: { type: 'zone', name: 'Same name' },
          zone_2: { type: 'zone', name: 'same_name' },
        },
        [],
      ),
    ).toThrow('Fire-risk export blocked')
    expect(createObjectURL).not.toHaveBeenCalled()
  } finally {
    createObjectURL.mockRestore()
  }
})
