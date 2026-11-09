import { describe, expect, it } from 'vitest'
import * as h from '../../test/appTestHarness'
import type {
  ReleaseImportSession,
  ReleaseImportLooseFileCandidate,
} from '../catalog/catalogApi'
import { ScanReportPanel } from './ImportReviewPanels'
import { LooseFilesPanel } from './ImportLooseFilesPanel'

h.setupAppTestHooks()

function candidate(
  id: string,
  decision: string,
): ReleaseImportLooseFileCandidate {
  return {
    id,
    decision,
    filePath: `/music/${id}.flac`,
    relativePath: `${id}.flac`,
    format: 'flac',
    sizeBytes: 100,
    lastModifiedAt: '',
    artistHints: [],
    albumArtistHints: [],
    reason: 'mixed_album_tags',
    createdAt: '',
    updatedAt: '',
  }
}

const session: ReleaseImportSession = {
  id: 'scan',
  sourceKind: 'localFiles',
  sourceRoot: '/music',
  scanMode: 'full',
  status: 'readyForReview',
  draftCount: 1,
  trackCount: 2,
  ignoredFileCount: 0,
  looseFileCandidateCount: 0,
  createdAt: '',
  updatedAt: '',
  diagnosticSummaries: [
    { code: 'read_failed', severity: 'error', count: 1 },
    { code: 'missing_tag', severity: 'warning', count: 2 },
  ],
  diagnostics: [
    {
      id: 'error',
      code: 'read_failed',
      severity: 'error',
      message: 'A file could not be read.',
      filePath: '/music/bad.flac',
      relativePath: 'bad.flac',
      source: 'scanner',
      createdAt: '',
    },
    {
      id: 'warning',
      code: 'missing_tag',
      severity: 'warning',
      message: 'A tag is missing.',
      filePath: '/music/untagged.flac',
      relativePath: 'untagged.flac',
      source: 'scanner',
      createdAt: '',
    },
  ],
}

describe('import review focus', () => {
  it('defaults to pending files and keeps processed history accessible', async () => {
    const user = h.userEvent.setup()
    h.render(
      <LooseFilesPanel
        candidates={[
          candidate('pending', 'pending'),
          candidate('converted', 'convertedToDraft'),
        ]}
      />,
    )
    expect(
      h.screen.getByRole('button', { name: /Pending\s*1/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(h.screen.getByText('pending.flac')).toBeVisible()
    expect(h.screen.queryByText('converted.flac')).not.toBeInTheDocument()
    await user.click(
      h.screen.getByRole('button', { name: /Consumed \/ converted\s*1/ }),
    )
    expect(h.screen.getByText('converted.flac')).toBeVisible()
    expect(h.screen.queryByText('pending.flac')).not.toBeInTheDocument()
  })

  it('removes a newly processed file from the pending view without losing its history', async () => {
    const user = h.userEvent.setup()
    const view = h.render(
      <LooseFilesPanel candidates={[candidate('track', 'pending')]} />,
    )
    view.rerender(
      <LooseFilesPanel candidates={[candidate('track', 'convertedToDraft')]} />,
    )
    expect(h.screen.getByText('No pending loose files.')).toBeVisible()
    expect(h.screen.queryByText('track.flac')).not.toBeInTheDocument()
    await user.click(h.screen.getByRole('button', { name: /All\s*1/ }))
    expect(h.screen.getByText('track.flac')).toBeVisible()
  })

  it('collapses detailed diagnostics but keeps errors and counts visible', async () => {
    const user = h.userEvent.setup()
    const view = h.render(<ScanReportPanel session={session} />)
    expect(
      h.screen.getByRole('status', { name: 'Scan errors' }),
    ).toHaveTextContent('A file could not be read.')
    expect(h.screen.getByText('2 warnings')).toBeVisible()
    expect(h.screen.getByText('A tag is missing.')).not.toBeVisible()
    await user.click(h.screen.getByText('Diagnostic details (2 groups)'))
    expect(h.screen.getByText('A tag is missing.')).toBeVisible()
    await user.click(h.screen.getByText('Diagnostic details (2 groups)'))
    expect(h.screen.getByText('A tag is missing.')).not.toBeVisible()
    await user.click(h.screen.getByText('Diagnostic details (2 groups)'))
    view.rerender(<ScanReportPanel session={{ ...session, id: 'another' }} />)
    expect(h.screen.getByText('A tag is missing.')).not.toBeVisible()
  })
})
