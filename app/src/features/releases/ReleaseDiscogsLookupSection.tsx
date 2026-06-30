import type {
  CatalogDictionaries,
  ExternalMetadataReleaseDetailDto,
} from '../catalog/catalogApi'
import {
  DiscogsReleaseLookupPanel,
  type DiscogsApplyGroups,
} from './DiscogsReleaseLookupPanel'
import type { EditableReleaseLabel } from './ReleaseEntryFormTypes'

type ReleaseDiscogsLookupSectionProps = Readonly<{
  dictionaries: CatalogDictionaries
  draftCatalogNumber: string
  externalSourceCount: number
  genres: string
  initialReleaseExists: boolean
  isOpen: boolean
  labels: EditableReleaseLabel[]
  releaseArtist: string
  releaseDate: string
  title: string
  trackCount: number
  year: string
  onApplyDraft: (
    draft: ExternalMetadataReleaseDetailDto,
    groups: DiscogsApplyGroups,
  ) => void
  onOpenChange: (isOpen: boolean) => void
}>

export function ReleaseDiscogsLookupSection({
  dictionaries,
  draftCatalogNumber,
  externalSourceCount,
  genres,
  initialReleaseExists,
  isOpen,
  labels,
  releaseArtist,
  releaseDate,
  title,
  trackCount,
  year,
  onApplyDraft,
  onOpenChange,
}: ReleaseDiscogsLookupSectionProps) {
  return (
    <DiscogsReleaseLookupPanel
      current={{
        artists: releaseArtist,
        externalSourceCount,
        genres,
        labels: labels
          .map((label) =>
            [label.label, label.catalogNumber].filter(Boolean).join(' '),
          )
          .join(', '),
        releaseDate,
        title,
        trackCount,
        year,
      }}
      dictionaries={dictionaries}
      isOpen={isOpen}
      mode={initialReleaseExists ? 'update' : 'create'}
      searchSeed={{
        artist: releaseArtist,
        catalogNumber:
          labels.find((label) => label.catalogNumber.trim().length > 0)
            ?.catalogNumber ?? draftCatalogNumber,
        title,
        trackCount: trackCount > 0 ? String(trackCount) : '',
        year: /^\d{4}$/.test(year) ? year : '',
      }}
      onApplyDraft={onApplyDraft}
      onOpenChange={onOpenChange}
    />
  )
}
