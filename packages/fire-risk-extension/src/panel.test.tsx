import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import {
  type AnyNode,
  BuildingNode,
  DoorNode,
  LevelNode,
  reconcileLevelStructure,
  useScene,
  WallNode,
  type ZoneNode,
  ZoneNode as ZoneSchema,
} from '@pascal-app/core'
import { selectRoom, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildFireRiskSceneExport } from './export'
import FireRiskPanel from './panel'

const levelId = 'level_fire_risk'
const buildingId = 'building_fire_risk'
const savedScene = useScene.getState()
const savedViewer = useViewer.getState()
const savedEditor = useEditor.getState()
const fireRisk = {
  schemaVersion: '0.1',
  spaceId: 'office-1',
  usage: 'Office',
  includeInCfast: false,
}
let room: ZoneNode

function reconcile(nodes: Record<string, AnyNode>) {
  let count = 0
  const plan = reconcileLevelStructure({
    levelId,
    nodes,
    mintId: (kind) => {
      let id: string
      do id = `${kind}_fire_risk_${++count}`
      while (nodes[id])
      return id
    },
  })
  const next = { ...nodes }
  for (const patch of plan.patches) {
    if (patch.op === 'create') next[patch.node.id] = patch.node
    else if (patch.op === 'delete') delete next[patch.id]
    else next[patch.id] = { ...next[patch.id], ...patch.data } as AnyNode
  }
  useScene.setState({ nodes: next })
  return next
}

function render() {
  // Server rendering normally reads startup state; exercise the current editor selection.
  const useSyncExternalStore = React.useSyncExternalStore
  const spy = spyOn(React, 'useSyncExternalStore').mockImplementation((subscribe, getSnapshot) =>
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot),
  )
  try {
    return renderToStaticMarkup(<FireRiskPanel />)
  } finally {
    spy.mockRestore()
  }
}

beforeEach(() => {
  const polygon: [number, number][] = [
    [0, 0],
    [8, 0],
    [8, 4],
    [0, 4],
  ]
  const walls = polygon.map((start, i) =>
    WallNode.parse({
      id: `wall_fire_risk_${i}`,
      parentId: levelId,
      start,
      end: polygon[(i + 1) % 4],
    }),
  )
  const building = BuildingNode.parse({ id: buildingId, children: [levelId] })
  const level = LevelNode.parse({
    id: levelId,
    parentId: buildingId,
    children: walls.map((wall) => wall.id),
  })
  const nodes = reconcile(
    Object.fromEntries([building, level, ...walls].map((node) => [node.id, node])),
  )
  room = Object.values(nodes).find((node): node is ZoneNode => node.type === 'zone')!
  room = { ...room, name: 'Office', metadata: { other: 'retained', fireRisk } }
  useScene.setState({
    nodes: { ...nodes, [room.id]: room },
    rootNodeIds: [building.id],
    readOnly: false,
  })
  useViewer.setState({ selection: { buildingId, levelId, zoneId: null, selectedIds: [] } })
  useEditor.setState({ room: null })
})

afterEach(() => {
  useScene.setState(savedScene)
  useViewer.setState(savedViewer)
  useEditor.setState(savedEditor)
})

test('normal room selection shows its name and saved annotations without creating an analysis zone', () => {
  selectRoom({ levelId, zoneId: room.id })
  expect(useViewer.getState().selection).toMatchObject({ zoneId: null, selectedIds: [] })
  const nodes = useScene.getState().nodes
  const html = render()
  expect(html).toContain('>Room</h3>')
  expect(html).toContain('>Office</p>')
  expect(html).toContain('value="office"')
  expect(html).not.toContain('>Analysis zone</h3>')
  expect(useScene.getState().nodes).toBe(nodes)
})

test('drilling into a wall keeps the room as the fire-risk editing target', () => {
  selectRoom({ levelId, zoneId: room.id })
  useViewer.getState().setSelection({ selectedIds: ['wall_fire_risk_0'] })
  expect(render()).toContain('value="office"')
})

test('an explicitly selected door takes precedence over its room context', () => {
  const door = DoorNode.parse({
    id: 'door_fire_risk',
    name: 'Exit 1',
    parentId: 'wall_fire_risk_0',
    metadata: { fireRisk: { openingId: 'exit-1', initialOpenFraction: 0.5 } },
  })
  useScene.setState({ nodes: { ...useScene.getState().nodes, [door.id]: door } })
  selectRoom({ levelId, zoneId: room.id })
  useViewer.getState().setSelection({ selectedIds: [door.id] })
  const html = render()
  expect(html).toContain('>Door or exit</h3>')
  expect(html).toContain('value="exit_1"')
  expect(html).not.toContain('Initial open fraction')
  expect(html).not.toContain('type="number"')
  expect(html).not.toContain('value="office"')
})

test('a manually drawn zone remains available with its existing annotations', () => {
  const zone = ZoneSchema.parse({
    id: 'zone_fire_risk_manual',
    parentId: levelId,
    name: 'Analysis area',
    polygon: [
      [20, 0],
      [24, 0],
      [24, 4],
    ],
    metadata: { fireRisk: { spaceId: 'custom-1' } },
  })
  useScene.setState({ nodes: { ...useScene.getState().nodes, [zone.id]: zone } })
  useViewer.getState().setSelection({ zoneId: zone.id })
  const html = render()
  expect(html).toContain('>Analysis zone</h3>')
  expect(html).toContain('>Analysis area</p>')
  expect(html).toContain('value="analysis_area"')
})

test('clearing the room or selecting an unsupported element without a room shows guidance', () => {
  selectRoom({ levelId, zoneId: room.id })
  useEditor.getState().clearRoom()
  for (const selectedIds of [[], ['wall_fire_risk_0']] as const) {
    useViewer.getState().setSelection({ selectedIds: [...selectedIds] })
    const html = render()
    expect(html).toContain('Select a room or door to edit')
    expect(html).not.toContain('>Space ID</span>')
    expect(html).not.toContain('value="office"')
  }
})

test('splitting and merging keeps the surviving room annotations without duplicating space IDs', () => {
  const divider = WallNode.parse({
    id: 'wall_fire_risk_divider',
    parentId: levelId,
    start: [2, 0],
    end: [2, 4],
  })
  const split = reconcile({ ...useScene.getState().nodes, [divider.id]: divider })
  const rooms = Object.values(split).filter((node): node is ZoneNode => node.type === 'zone')
  expect(rooms).toHaveLength(2)
  expect(split[room.id]!.metadata).toEqual({ other: 'retained', fireRisk })
  const newRoom = rooms.find((node) => node.id !== room.id)!
  expect(newRoom.metadata.fireRisk).toBeUndefined()
  selectRoom({ levelId, zoneId: newRoom.id })
  expect(render()).not.toContain('value="office"')
  const { [divider.id]: _, ...withoutDivider } = split
  const merged = reconcile(withoutDivider)
  expect(Object.values(merged).filter((node) => node.type === 'zone')).toHaveLength(1)
  expect(merged[room.id]!.metadata).toEqual({ other: 'retained', fireRisk })
  // A selection of the retired room cannot edit the survivor accidentally.
  expect(render()).not.toContain('value="office"')
  selectRoom({ levelId, zoneId: room.id })
  expect(render()).toContain('value="office"')
  const exported = buildFireRiskSceneExport(merged, [buildingId])
  expect((exported.scene.nodes[room.id] as ZoneNode).metadata.fireRisk).toEqual({
    ...fireRisk,
    spaceId: 'office',
  })
})

test('space IDs follow room renames and remain read-only despite saved overrides', () => {
  selectRoom({ levelId, zoneId: room.id })
  const nodes = useScene.getState().nodes
  useScene.setState({ nodes: { ...nodes, [room.id]: { ...room, name: 'Room 7' } } })
  expect(render()).toMatch(/<input[^>]*readOnly=""[^>]*value="room_7"/)
  useScene.setState({ nodes: { ...nodes, [room.id]: { ...room, name: 'New Room 8' } } })
  expect(render()).toContain('value="new_room_8"')
})

test('opening IDs follow door renames and remain read-only despite saved overrides', () => {
  const door = DoorNode.parse({
    id: 'door_fire_risk',
    name: 'Door 7',
    parentId: 'wall_fire_risk_0',
    metadata: { fireRisk: { openingId: 'old' } },
  })
  const nodes = useScene.getState().nodes
  useScene.setState({ nodes: { ...nodes, [door.id]: door } })
  useViewer.getState().setSelection({ selectedIds: [door.id] })
  expect(render()).toMatch(/<input[^>]*readOnly=""[^>]*value="door_7"/)
  useScene.setState({ nodes: { ...nodes, [door.id]: { ...door, name: 'Main Exit 2' } } })
  expect(render()).toContain('value="main_exit_2"')
})
