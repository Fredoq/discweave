import type { LocalEditTags } from './localFileEditModel'
import { hasTagValues } from './localFileEditHelpers'

export function TagSupportBadge({ tagWritable }: { tagWritable: boolean }) {
  return (
    <span
      className={`local-file-edit-chip ${
        tagWritable
          ? 'local-file-edit-chip-active'
          : 'local-file-edit-chip-muted'
      }`}
    >
      {tagWritable ? 'Writable tags' : 'Read-only tags'}
    </span>
  )
}

export function TagChangeBadge({ tagChanges }: { tagChanges: LocalEditTags }) {
  return (
    <span
      className={`local-file-edit-chip ${
        hasTagValues(tagChanges)
          ? 'local-file-edit-chip-active'
          : 'local-file-edit-chip-muted'
      }`}
    >
      {hasTagValues(tagChanges) ? 'Will update tags' : 'No tag changes'}
    </span>
  )
}
