import type { EditorHostPanel } from '@pascal-app/editor'

export const fireRiskHostPanel: EditorHostPanel = {
  id: 'pascal:fire-risk',
  pluginId: 'pascal:fire-risk',
  label: 'Fire risk',
  category: 'Analysis',
  summary: 'Tag rooms and exits and export geometry for fire-risk analysis.',
  description:
    'Annotate room zones and doors for CFAST and evacuation workflows, then download the scene for the fire-risk engine.',
  defaultInstalled: false,
  icon: { kind: 'iconify', name: 'lucide:flame' },
  component: () => import('./panel'),
}

export {
  buildFireRiskSceneExport,
  downloadFireRiskScene,
  type FireRiskSceneExport,
  PASCAL_EDITOR_VERSION,
} from './export'
