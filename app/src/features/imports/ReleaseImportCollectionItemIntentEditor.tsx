import type {
  ReleaseImportCollectionItemIntentDto,
  ReleaseImportMediumIntentDto,
} from '../catalog/catalogApi'

type Props = Readonly<{
  intent: ReleaseImportCollectionItemIntentDto | null | undefined
  onChange: (intent: ReleaseImportCollectionItemIntentDto) => void
}>

const mediumKinds = [
  ['digital', 'Digital'],
  ['vinyl', 'Vinyl'],
  ['cd', 'CD'],
  ['cassette', 'Cassette'],
  ['other', 'Other'],
] as const

export function ReleaseImportCollectionItemIntentEditor({
  intent,
  onChange,
}: Props) {
  const current = intent ?? { kind: 'newWanted' as const, medium: null }
  const medium =
    current.kind === 'newWanted' ? current.medium : current.expectedMedium

  return (
    <section className="release-form-section imports-release-section">
      <div className="release-form-section-header">
        <div>
          <h3>Collection item</h3>
          <p>
            Choose whether the original release is wanted or reuses an owned
            copy.
          </p>
        </div>
      </div>
      <div className="imports-release-grid">
        <label className="settings-control">
          <span>Collection action</span>
          <select
            value={current.kind}
            onChange={(event) => {
              if (event.currentTarget.value === 'reuseExisting') {
                onChange({
                  kind: 'reuseExisting',
                  ownedItemId: '',
                  expectedMedium: { kind: 'digital' },
                })
              } else {
                onChange({ kind: 'newWanted', medium: null })
              }
            }}
          >
            <option value="newWanted">Add release to Wanted</option>
            <option value="reuseExisting">Reuse an owned item</option>
          </select>
        </label>
        {current.kind === 'reuseExisting' ? (
          <label className="settings-control">
            <span>Owned item ID</span>
            <input
              value={current.ownedItemId}
              placeholder="UUID"
              onChange={(event) =>
                onChange({ ...current, ownedItemId: event.currentTarget.value })
              }
            />
          </label>
        ) : null}
        <label className="settings-control">
          <span>Medium</span>
          <select
            value={medium?.kind ?? ''}
            onChange={(event) => {
              const nextMedium = createMedium(event.currentTarget.value)
              if (current.kind === 'newWanted') {
                onChange({ ...current, medium: nextMedium })
              } else if (nextMedium) {
                onChange({ ...current, expectedMedium: nextMedium })
              }
            }}
          >
            <option value="">Select medium</option>
            {mediumKinds.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {medium?.kind === 'vinyl' ? (
          <label className="settings-control">
            <span>Format description</span>
            <input
              value={medium.formatDescription}
              onChange={(event) =>
                updateMedium(current, onChange, {
                  ...medium,
                  formatDescription: event.currentTarget.value,
                })
              }
            />
          </label>
        ) : null}
        {medium?.kind === 'cd' ? (
          <label className="settings-control">
            <span>Disc count</span>
            <input
              min={1}
              type="number"
              value={medium.discCount}
              onChange={(event) =>
                updateMedium(current, onChange, {
                  ...medium,
                  discCount:
                    Number.parseInt(event.currentTarget.value, 10) || 0,
                })
              }
            />
          </label>
        ) : null}
        {medium?.kind === 'cassette' ? (
          <label className="settings-control">
            <span>Tape type</span>
            <input
              value={medium.tapeType}
              onChange={(event) =>
                updateMedium(current, onChange, {
                  ...medium,
                  tapeType: event.currentTarget.value,
                })
              }
            />
          </label>
        ) : null}
        {medium?.kind === 'other' ? (
          <label className="settings-control">
            <span>Medium name</span>
            <input
              value={medium.name}
              onChange={(event) =>
                updateMedium(current, onChange, {
                  ...medium,
                  name: event.currentTarget.value,
                })
              }
            />
          </label>
        ) : null}
      </div>
    </section>
  )
}

function createMedium(kind: string): ReleaseImportMediumIntentDto | null {
  switch (kind) {
    case 'digital':
      return { kind }
    case 'vinyl':
      return { kind, formatDescription: '' }
    case 'cd':
      return { kind, discCount: 1 }
    case 'cassette':
      return { kind, tapeType: '' }
    case 'other':
      return { kind, name: '' }
    default:
      return null
  }
}

function updateMedium(
  intent: ReleaseImportCollectionItemIntentDto,
  onChange: Props['onChange'],
  medium: ReleaseImportMediumIntentDto,
) {
  if (intent.kind === 'newWanted') {
    onChange({ ...intent, medium })
  } else {
    onChange({ ...intent, expectedMedium: medium })
  }
}
