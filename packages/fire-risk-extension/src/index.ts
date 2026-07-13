import type { EditorHostPanel } from '@pascal-app/editor'

export const fireRiskHostPanel: EditorHostPanel = {
  id: 'pascal:fire-risk',
  label: 'Fire risk',
  icon: { kind: 'iconify', name: 'lucide:flame' },
  component: () => import('./panel'),
}

export {
  buildFireRiskSceneExport,
  downloadFireRiskScene,
  PASCAL_EDITOR_VERSION,
  type FireRiskSceneExport,
} from './export'
