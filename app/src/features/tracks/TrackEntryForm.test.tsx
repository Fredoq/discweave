import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import { artistRecords } from '../artists/artistsData'
import { releaseRecords } from '../releases/releasesData'
import { trackRecords, type TrackRecord } from './tracksData'
import { TrackEntryForm } from './TrackEntryForm'

describe('TrackEntryForm', () => {
  it('preserves existing track relations when saving the form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const initialTrack: TrackRecord = {
      ...trackRecords[0],
      relations: [
        {
          type: 'Appears on',
          target: 'Selected Ambient Works 85-92',
          detail: 'Track 3 on the Warp album release.',
        },
        {
          type: 'Edit of',
          target: 'Polynomial-C',
          detail: 'Linked through the relation graph.',
        },
      ],
    }

    render(
      <TrackEntryForm
        artists={artistRecords}
        dictionaries={defaultCatalogDictionaries}
        initialTrack={initialTrack}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        releases={releaseRecords}
        tracks={trackRecords}
      />,
    )

    const form = screen.getByRole('form', { name: 'Edit track' })
    await user.click(within(form).getByRole('button', { name: 'Save record' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const submittedTrack = onSubmit.mock.calls[0][0] as TrackRecord
    expect(submittedTrack.relations).toEqual([
      {
        type: 'Appears on',
        target: 'Selected Ambient Works 85-92',
        detail: 'Track 3 on the Warp album release.',
      },
      {
        type: 'Edit of',
        target: 'Polynomial-C',
        detail: 'Linked through the relation graph.',
      },
    ])
  })
})
