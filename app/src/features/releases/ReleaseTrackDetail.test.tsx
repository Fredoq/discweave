import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { artistRecords } from '../artists/artistsData'
import { trackRecords } from '../tracks/tracksData'
import type { DraftTrackRow } from './ReleaseEntryFormTypes'
import { ReleaseTrackDetail } from './ReleaseTrackDetail'

const linkedTrack = trackRecords[0]

const selectedDraftTrack: DraftTrackRow = {
  id: 'draft-track-1',
  existingTrackId: linkedTrack.id,
  existingTrackQuery: '',
  position: '1',
  disc: '',
  side: '',
  title: linkedTrack.title,
  durationParts: { hours: '', minutes: '4', seconds: '44' },
  versionYear: '',
  inheritReleaseArtistCredits: true,
  artistCredits: [],
  draftArtist: '',
  draftArtistId: '',
}

describe('ReleaseTrackDetail', () => {
  it('keeps the clear action visible for a linked track with an empty query', () => {
    render(
      <ReleaseTrackDetail
        addTrackArtist={vi.fn()}
        artists={artistRecords}
        clearExistingTrack={vi.fn()}
        creditRoleOptions={[]}
        handleDraftTrackChange={vi.fn()}
        handleDraftTrackDurationChange={vi.fn()}
        handleTrackArtistChange={vi.fn()}
        handleTrackDraftArtistChange={vi.fn()}
        isVariousArtists={false}
        releaseMainArtistCredits={[]}
        removeDraftTrack={vi.fn()}
        removeTrackArtist={vi.fn()}
        selectExistingTrack={vi.fn()}
        selectedCustomTrackCredits={[]}
        selectedDraftTrack={selectedDraftTrack}
        selectedDraftTrackIndex={1}
        selectedDraftTrackTitleRef={{ current: null }}
        selectedExistingTrack={linkedTrack}
        selectedExistingTrackSuggestions={[]}
        setDraftTrackMode={vi.fn()}
        setTrackArtistMode={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Clear linked track' }),
    ).toBeInTheDocument()
  })
})
