import { expect, test } from 'bun:test'
import { fireRiskIdFromName } from './identifiers'

test.each([
  ['Room 7', 'room_7'],
  ['Main Exit 2', 'main_exit_2'],
  ['  Room   7  ', 'room_7'],
  ['ROOM\t7\nEast', 'room_7_east'],
  ['Room_7', 'room_7'],
  ['', ''],
  ['   ', ''],
  [undefined, ''],
])('derives a fire-risk ID from %j', (name, expected) => {
  expect(fireRiskIdFromName(name)).toBe(expected)
})
