'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { downloadFireRiskScene } from './export'

type MetadataRecord = Record<string, unknown>

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MetadataRecord)
    : {}
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function Field({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-sidebar-foreground/70">{label}</span>
      <input
        className="h-9 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2 text-sidebar-foreground outline-none focus:border-sidebar-ring"
        onChange={(event) => onChange(event.target.value)}
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
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  )
}

export default function FireRiskPanel() {
  const selectedId = useViewer((state) =>
    (state.selection.selectedIds[0] ?? state.selection.zoneId ?? null) as AnyNodeId | null,
  )
  const node = useScene((state) => (selectedId ? state.nodes[selectedId] : undefined))
  const updateNode = useScene((state) => state.updateNode)
  const nodes = useScene((state) => state.nodes)
  const rootNodeIds = useScene((state) => state.rootNodeIds)
  const isSupported = node?.type === 'zone' || node?.type === 'door'
  const metadata = asRecord(node?.metadata)
  const fireRisk = asRecord(metadata.fireRisk)

  const updateFireRisk = (patch: MetadataRecord) => {
    if (!node) return
    updateNode(node.id, {
      metadata: {
        ...metadata,
        fireRisk: {
          ...fireRisk,
          schemaVersion: '0.1',
          ...patch,
        },
      },
    })
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 text-sidebar-foreground">
      <header>
        <h2 className="font-semibold text-base">Fire risk</h2>
        <p className="mt-1 text-sidebar-foreground/60 text-xs">
          Tag explicit room zones and wall-hosted doors, then export geometry for the fire-risk engine.
        </p>
      </header>

      {isSupported && node?.type === 'zone' ? (
        <section className="flex flex-col gap-3 rounded-lg border border-sidebar-border p-3">
          <h3 className="font-medium text-sm">Room zone</h3>
          <Field
            label="Space ID"
            onChange={(spaceId) => updateFireRisk({ spaceId })}
            value={stringValue(fireRisk.spaceId)}
          />
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
          <Field
            label="Opening ID"
            onChange={(openingId) => updateFireRisk({ openingId })}
            value={stringValue(fireRisk.openingId)}
          />
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sidebar-foreground/70">Initial open fraction</span>
            <input
              className="h-9 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2 text-sidebar-foreground outline-none focus:border-sidebar-ring"
              max="1"
              min="0"
              onChange={(event) => {
                const initialOpenFraction = Number(event.target.value)
                if (Number.isFinite(initialOpenFraction)) updateFireRisk({ initialOpenFraction })
              }}
              step="0.05"
              type="number"
              value={numberValue(fireRisk.initialOpenFraction, 1)}
            />
          </label>
        </section>
      ) : null}

      {!isSupported ? (
        <p className="rounded-lg border border-dashed border-sidebar-border p-3 text-sidebar-foreground/60 text-sm">
          Select a room zone or door to edit its fire-risk metadata.
        </p>
      ) : null}

      <div className="mt-auto border-sidebar-border border-t pt-4">
        <button
          className="w-full rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
          onClick={() => downloadFireRiskScene(nodes as Record<string, unknown>, rootNodeIds)}
          type="button"
        >
          Export fire-risk geometry
        </button>
      </div>
    </div>
  )
}
