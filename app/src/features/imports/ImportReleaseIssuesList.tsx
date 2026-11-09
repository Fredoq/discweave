import type { ImportIssue } from '../catalog/catalogApi'

export function ReleaseIssuesList({
  issues,
  releaseDate,
  year,
  onFindDate,
}: Readonly<{
  issues: ImportIssue[]
  releaseDate?: string | null
  year?: number | null
  onFindDate?: () => void
}>) {
  const visibleIssues = issues.filter(
    (issue) =>
      issue.code !== 'import.release_date_partial' ||
      !isCompleteDate(releaseDate),
  )
  if (visibleIssues.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="release-import-issues-heading"
      className="release-form-section imports-release-section imports-release-issues-section"
    >
      <div className="release-form-section-header">
        <div>
          <h3 id="release-import-issues-heading">Release issues</h3>
          <p>Review release-level warnings before confirming.</p>
        </div>
      </div>
      <output className="imports-issue-list">
        {visibleIssues.map((issue) => (
          <span
            className="imports-issue-item"
            key={`${issue.severity}-${issue.code}-${issue.message}`}
          >
            <strong>{issue.severity}</strong> {issueMessage(issue, year)}
          </span>
        ))}
      </output>
      {onFindDate &&
      visibleIssues.some(
        (issue) => issue.code === 'import.release_date_partial',
      ) ? (
        <button
          className="button button-secondary button-compact"
          type="button"
          onClick={onFindDate}
        >
          Check this edition on Discogs
        </button>
      ) : null}
    </section>
  )
}

function issueMessage(issue: ImportIssue, year?: number | null) {
  switch (issue.code) {
    case 'import.release_date_invalid':
      return 'Release date could not be parsed. Review Release date, then Save. A date is optional.'
    case 'import.release_date_partial':
      return partialDateMessage(year)
    case 'release_import.loose_file_album_tag_conflict':
      return `${conflictEvidence(issue, 'album names')}. Check Title and the tracklist above and below. If these files belong together, choose the release title and Save. Saving keeps this source-file notice. After confirming the import, Resolve the notice in Workbench if the grouping is intentional. Audio file tags are unchanged.`
    case 'release_import.loose_file_album_artist_conflict':
      return `${conflictEvidence(issue, 'album artists')}. Check Release artists and the tracklist below, then Save your choices. Saving keeps this source-file notice. After confirming the import, Resolve the notice in Workbench if the grouping is intentional. Audio file tags are unchanged.`
    default:
      return issue.message
  }
}

function partialDateMessage(year?: number | null) {
  const precision = year
    ? `Only the year (${year}) is known.`
    : 'The exact release date is unknown.'
  return `${precision} You can keep the year and leave Release date empty, or check the matching edition on Discogs. Apply a full date only if that edition provides one.`
}

function conflictEvidence(issue: ImportIssue, field: string) {
  return issue.message.startsWith('Selected loose files have conflicting')
    ? `Selected files contain different ${field}`
    : issue.message
}

function isCompleteDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}
