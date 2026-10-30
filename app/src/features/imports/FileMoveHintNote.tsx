import type { ReleaseImportFileMoveHint } from '../catalog/catalogApi'

type FileMoveHintNoteProps = Readonly<{
  hint: ReleaseImportFileMoveHint
}>

export function FileMoveHintNote({ hint }: FileMoveHintNoteProps) {
  return (
    <output className="imports-move-note">
      <strong>Moved or renamed file hint:</strong>{' '}
      {hint.previousPath
        ? `previously at ${hint.previousPath}`
        : 'multiple previous paths match this file'}{' '}
      ({moveHintMatchLabel(hint.matchKind)}, {hint.confidence} confidence)
    </output>
  )
}

function moveHintMatchLabel(matchKind: string) {
  if (matchKind === 'contentHash') {
    return 'same content hash'
  }

  if (matchKind === 'scanManifestIdentity') {
    return 'same scan manifest identity'
  }

  if (matchKind === 'sizeMtime') {
    return 'same size and modified time'
  }

  return matchKind
}
