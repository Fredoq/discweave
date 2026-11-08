import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReleaseIssuesList } from './ImportReleaseIssuesList'

const partialDate = {
  code: 'import.release_date_partial',
  severity: 'warning' as const,
  message: 'Release date has unknown month or day',
}

describe('ReleaseIssuesList', () => {
  it('offers a year-only choice and an explicit edition lookup without guessing a date', async () => {
    const onFindDate = vi.fn()
    render(
      <ReleaseIssuesList
        issues={[partialDate]}
        year={1991}
        onFindDate={onFindDate}
      />,
    )
    expect(screen.getByText(/Only the year \(1991\) is known/)).toBeVisible()
    expect(screen.getByText(/leave Release date empty/)).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Check this edition on Discogs' }),
    )
    expect(onFindDate).toHaveBeenCalledOnce()
  })

  it('hides the old partial date warning when the reviewed date is complete', () => {
    render(
      <ReleaseIssuesList issues={[partialDate]} releaseDate="1991-04-15" />,
    )
    expect(
      screen.queryByRole('heading', { name: 'Release issues' }),
    ).not.toBeInTheDocument()
  })

  it.each(['1991', '1991-00-00', '1991-02-31'])(
    'keeps the partial-date notice for an incomplete or invalid date %s',
    (releaseDate) => {
      render(
        <ReleaseIssuesList issues={[partialDate]} releaseDate={releaseDate} />,
      )
      expect(
        screen.getByText(/The exact release date is unknown/),
      ).toBeVisible()
    },
  )

  it('explains legacy album conflicts without the obsolete jargon', () => {
    render(
      <ReleaseIssuesList
        issues={[
          {
            code: 'release_import.loose_file_album_tag_conflict',
            severity: 'warning',
            message:
              'Selected loose files have conflicting album tag hints; review the release title before confirming.',
          },
        ]}
      />,
    )
    expect(
      screen.getByText(/Selected files contain different album names/),
    ).toBeVisible()
    expect(screen.getByText(/choose the release title and Save/)).toBeVisible()
    expect(
      screen.getByText(/Saving keeps this source-file notice/),
    ).toBeVisible()
    expect(
      screen.getByText(
        /After confirming the import, Resolve the notice in Workbench/,
      ),
    ).toBeVisible()
    expect(screen.queryByText(/tag hints/)).not.toBeInTheDocument()
  })

  it('keeps tag evidence and unrelated issues visible', () => {
    render(
      <ReleaseIssuesList
        issues={[
          partialDate,
          {
            code: 'release_import.loose_file_album_artist_conflict',
            severity: 'warning',
            message:
              'File album artists differ: "Artist A" (2 files), "Artist B" (1 file)',
          },
          {
            code: 'other.warning',
            severity: 'warning',
            message: 'An unrelated issue',
          },
        ]}
        releaseDate="1991-04-15"
      />,
    )
    expect(screen.getByText(/"Artist A" \(2 files\)/)).toBeVisible()
    expect(screen.getByText(/Audio file tags are unchanged/)).toBeVisible()
    expect(
      screen.getByText(/Saving keeps this source-file notice/),
    ).toBeVisible()
    expect(
      screen.getByText(
        /After confirming the import, Resolve the notice in Workbench/,
      ),
    ).toBeVisible()
    expect(screen.getByText(/An unrelated issue/)).toBeVisible()
    expect(screen.queryByText(/exact release date/)).not.toBeInTheDocument()
  })
})
