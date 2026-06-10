import type { Dispatch, SetStateAction } from 'react'
import type { OwnedCopy } from './releasesData'

type ReleaseOwnedCopySectionProps = {
  includeOwnedCopy: boolean
  mediaTypeOptions: string[]
  medium: string
  setIncludeOwnedCopy: Dispatch<SetStateAction<boolean>>
  setMedium: Dispatch<SetStateAction<string>>
  setStatus: Dispatch<SetStateAction<OwnedCopy['status'] | ''>>
  status: OwnedCopy['status'] | ''
}

export function ReleaseOwnedCopySection({
  includeOwnedCopy,
  mediaTypeOptions,
  medium,
  setIncludeOwnedCopy,
  setMedium,
  setStatus,
  status,
}: ReleaseOwnedCopySectionProps) {
  return (
    <section className="manual-entry-wide release-form-section release-owned-copy-section">
      <div className="release-form-section-header">
        <div>
          <h3>Owned copy</h3>
          <p>Add this only when the collection has a concrete copy.</p>
        </div>
        <label className="compact-checkbox">
          <input
            type="checkbox"
            checked={includeOwnedCopy}
            onChange={(event) => setIncludeOwnedCopy(event.target.checked)}
          />
          <span>Add owned copy</span>
        </label>
      </div>
      {includeOwnedCopy ? (
        <div className="release-owned-copy-grid">
          <label>
            <span>Media</span>
            <select
              value={medium}
              onChange={(event) => setMedium(event.target.value)}
            >
              <option value="">Not recorded</option>
              {mediaTypeOptions.map((mediaType) => (
                <option key={mediaType}>{mediaType}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Ownership status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as OwnedCopy['status'] | '')
              }
            >
              <option value="">Not recorded</option>
              <option>Owned</option>
              <option>Wanted</option>
              <option>Sold</option>
              <option>Needs digitization</option>
            </select>
          </label>
        </div>
      ) : null}
    </section>
  )
}
