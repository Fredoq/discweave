import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReleaseImportDraft } from '../catalog/catalogApi'
import { ExternalProvenanceSelectionPanel } from './ExternalProvenanceSelectionPanel'

describe('ExternalProvenanceSelectionPanel', () => {
  it('sorts independent release and track provenance choices', () => {
    const onSelectRelease = vi.fn()
    const onSelectTrack = vi.fn()
    const draft = {
      id: 'draft',
      sourceKind: 'externalMetadata',
      sourcePath: null,
      relativePath: null,
      status: 'needsReview',
      title: 'External release',
      type: 'album',
      isVariousArtists: false,
      notOnLabel: false,
      artistNames: [],
      selectedArtistIds: [],
      artistSuggestions: [],
      genres: [],
      tags: [],
      issues: [],
      tracks: [],
      localProvenanceSelection: {
        selectedReleaseId: null,
        selectedTrackId: null,
      },
      provenanceReleaseCandidates: [
        { id: 'z-release', title: 'Zulu' },
        { id: 'a-release', title: 'Alpha' },
      ],
      provenanceTrackCandidates: [
        { id: 'z-track', title: 'Zulu track' },
        { id: 'a-track', title: 'Alpha track' },
      ],
    } satisfies ReleaseImportDraft

    render(
      <ExternalProvenanceSelectionPanel
        draft={draft}
        isPending={false}
        onSelectRelease={onSelectRelease}
        onSelectTrack={onSelectTrack}
      />,
    )

    const releaseSelect = screen.getByLabelText('Selected release ID')
    const trackSelect = screen.getByLabelText('Selected track ID')
    expect(
      [...releaseSelect.querySelectorAll('option')].map(
        (item) => item.textContent,
      ),
    ).toEqual(['Select a release', 'Alpha', 'Zulu'])
    expect(
      [...trackSelect.querySelectorAll('option')].map(
        (item) => item.textContent,
      ),
    ).toEqual(['Select a track', 'Alpha track', 'Zulu track'])

    fireEvent.change(releaseSelect, { target: { value: 'a-release' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Select release provenance' }),
    )
    fireEvent.change(trackSelect, { target: { value: 'a-track' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Select track provenance' }),
    )
    expect(onSelectRelease).toHaveBeenCalledWith('a-release')
    expect(onSelectTrack).toHaveBeenCalledWith('a-track')
  })
})
