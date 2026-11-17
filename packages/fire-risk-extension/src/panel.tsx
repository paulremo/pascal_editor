'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useState } from 'react'
import { downloadFireRiskScene } from './export'
import { fireRiskIdFromName } from './identifiers'

type MetadataRecord = Record<string, unknown>

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MetadataRecord)
    : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function Field({
  label,
  onChange,
  value,
}: {
  label: string
  onChange?: (value: string) => void
  value: string
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-sidebar-foreground/70">{label}</span>
      <input
        className="h-9 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2 text-sidebar-foreground outline-none focus:border-sidebar-ring"
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={!onChange}
        type="text"
        value={value}
      />
    </label>
  )
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span className="text-sidebar-foreground/70">{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  )
}

export default function FireRiskPanel() {
  const [exportError, setExportError] = useState<string | null>(null)
  const roomZoneId = useEditor((state) => state.room?.zoneId ?? null)
  const selectedId = useViewer(
    (state) =>
      (state.selection.selectedIds[0] ?? state.selection.zoneId ?? null) as AnyNodeId | null,
  )
  const node = useScene((state) => {
    const selected = selectedId ? state.nodes[selectedId] : undefined
    if (selected?.type === 'door' || selected?.type === 'zone') return selected
    const room = roomZoneId ? state.nodes[roomZoneId as AnyNodeId] : undefined
    return room?.type === 'zone' && room.spaceRole === 'room' ? room : undefined
  })
  const updateNode = useScene((state) => state.updateNode)
  const isSupported = node?.type === 'zone' || node?.type === 'door'
  const isRoom = node?.type === 'zone' && node.spaceRole === 'room'
  const metadata = asRecord(node?.metadata)
  const { initialOpenFraction: _initialOpenFraction, ...fireRisk } = asRecord(metadata.fireRisk)

  const updateFireRisk = (patch: MetadataRecord) => {
    if (!node) return
    updateNode(node.id, {
      metadata: {
        ...metadata,
        fireRisk: {
          ...fireRisk,
          schemaVersion: '0.1',
          ...patch,
          [node.type === 'door' ? 'openingId' : 'spaceId']: fireRiskIdFromName(node.name),
        },
      },
    })
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 text-sidebar-foreground">
      <header>
        <h2 className="font-semibold text-base">Fire risk</h2>
        <p className="mt-1 text-sidebar-foreground/60 text-xs">
          Select a room to add fire-risk information, or a door to configure an opening or exit.
          Manually drawn zones are optional.
        </p>
        <p className="mt-1 text-sidebar-foreground/60 text-xs">
          IDs follow room and door names. Rename them in the editor to change their IDs.
        </p>
      </header>

      {isSupported && node?.type === 'zone' ? (
        <section className="flex flex-col gap-3 rounded-lg border border-sidebar-border p-3">
          <h3 className="font-medium text-sm">{isRoom ? 'Room' : 'Analysis zone'}</h3>
          <p className="text-sidebar-foreground/70 text-sm">{node.name}</p>
          <Field label="Space ID" value={fireRiskIdFromName(node.name)} />
          <Field
            label="Usage"
            onChange={(usage) => updateFireRisk({ usage })}
            value={stringValue(fireRisk.usage)}
          />
          <Toggle
            checked={fireRisk.includeInCfast !== false}
            label="Include in CFAST"
            onChange={(includeInCfast) => updateFireRisk({ includeInCfast })}
          />
        </section>
      ) : null}

      {isSupported && node?.type === 'door' ? (
        <section className="flex flex-col gap-3 rounded-lg border border-sidebar-border p-3">
          <h3 className="font-medium text-sm">Door or exit</h3>
          <p className="text-sidebar-foreground/70 text-sm">{node.name}</p>
          <Field label="Opening ID" value={fireRiskIdFromName(node.name)} />
          <Toggle
            checked={fireRisk.traversable !== false}
            label="Traversable"
            onChange={(traversable) => updateFireRisk({ traversable })}
          />
          <Toggle
            checked={fireRisk.finalExit === true}
            label="Final exit"
            onChange={(finalExit) => updateFireRisk({ finalExit })}
          />
        </section>
      ) : null}

      {!isSupported ? (
        <p className="rounded-lg border border-dashed border-sidebar-border p-3 text-sidebar-foreground/60 text-sm">
          Select a room or door to edit its fire-risk information. No additional zone is needed.
        </p>
      ) : null}

      <div className="mt-auto border-sidebar-border border-t pt-4">
        {exportError ? (
          <p className="mb-3 whitespace-pre-line text-destructive text-sm" role="alert">
            {exportError}
          </p>
        ) : null}
        <button
          className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
          onClick={() => {
            setExportError(null)
            const { nodes, rootNodeIds } = useScene.getState()
            try {
              downloadFireRiskScene(nodes as Record<string, unknown>, rootNodeIds)
            } catch (error) {
              setExportError(
                error instanceof Error ? error.message : 'Unable to export fire-risk geometry.',
              )
            }
          }}
          type="button"
        >
          Export fire-risk geometry
        </button>
      </div>
    </div>
  )
}
