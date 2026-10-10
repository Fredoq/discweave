import type { ImportIssue } from '../catalog/catalogApi'

export function ReleaseIssuesList({
  issues,
}: Readonly<{
  issues: ImportIssue[]
}>) {
  if (issues.length === 0) {
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
        {issues.map((issue) => (
          <span
            className="imports-issue-item"
            key={`${issue.severity}-${issue.code}-${issue.message}`}
          >
            <strong>{issue.severity}</strong>{' '}
            {issue.code === 'import.release_date_invalid'
              ? 'Release date could not be parsed. Review Release date, then Save. A date is optional.'
              : issue.message}
          </span>
        ))}
      </output>
    </section>
  )
}
