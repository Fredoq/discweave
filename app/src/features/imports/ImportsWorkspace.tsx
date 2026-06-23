import './imports-confirmation.css'
import './imports-loose-files.css'
import './imports-source.css'
import './imports.css'
import { ImportsWorkspaceView } from './ImportsWorkspaceView'
import {
  useImportsWorkspaceController,
  type ImportsWorkspaceProps,
} from './useImportsWorkspaceController'

export function ImportsWorkspace(props: ImportsWorkspaceProps) {
  const controller = useImportsWorkspaceController(props)

  return <ImportsWorkspaceView controller={controller} />
}
