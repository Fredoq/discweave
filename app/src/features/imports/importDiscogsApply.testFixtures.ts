import type {
  ExternalMetadataReleaseDetailDto,
  ReleaseImportDraft,
} from '../catalog/catalogApi'
import { defaultCatalogDictionaries } from '../catalog/catalogApi'
import { buildDiscogsTrackMapping } from '../releases/discogsTrackMapping'
import { applyDiscogsReleaseToImportDraft } from './importDiscogsApply'

function localTrack(
  id: string,
  title: string,
  relativePath: string,
  position: number,
): ReleaseImportDraft['tracks'][number] {
  const filePath = `/Music/Release/${relativePath}`
  return {
    id,
    sourceKind: 'localFiles',
    filePath,
    relativePath,
    format: 'm4a',
    sizeBytes: 100,
    lastModifiedAt: '2026-06-01T12:00:00Z',
    localFile: {
      filePath,
      relativePath,
      format: 'm4a',
      sizeBytes: 100,
      lastModifiedAt: '2026-06-01T12:00:00Z',
    },
    durationSeconds: 300,
    position,
    disc: null,
    side: null,
    title,
    artistNames: [],
    artistCredits: [],
    artistSuggestions: [],
    trackSuggestions: [],
    isSkipped: false,
    selectedTrackId: null,
    selectedArtistIds: [],
    issues: [],
    inheritReleaseArtistCredits: false,
  }
}

export function trackMappingFixture() {
  const currentTitles = [
    'Another Chance (Original Edit)',
    'Another Chance (Afterlife Mix)',
    "Another Chance (S-Man's Dark Nite Mix)",
  ]
  const discogsTitles = [
    'Another Chance (Original Mix)',
    "Another Chance (S-Man's Dark Nite Mix)",
    'Another Chance (Afterlife Mix)',
  ]
  const draft: ReleaseImportDraft = {
    id: 'draft-1',
    sourceKind: 'localFiles',
    sourcePath: '/Music/Release',
    relativePath: 'Release',
    status: 'needsReview',
    title: 'Another Chance',
    type: 'single',
    year: 1990,
    isVariousArtists: false,
    notOnLabel: true,
    artistNames: [],
    selectedArtistIds: [],
    artistSuggestions: [],
    genres: [],
    tags: [],
    issues: [],
    tracks: currentTitles.map((title, index) =>
      localTrack(
        `track-${index + 1}`,
        title,
        `${String(index + 1).padStart(2, '0')} ${title}.m4a`,
        index + 1,
      ),
    ),
  }
  const detail: ExternalMetadataReleaseDetailDto = {
    source: {
      providerName: 'discogs',
      resourceType: 'release',
      externalId: '123',
      sourceUrl: 'https://www.discogs.com/release/123',
      attribution: 'Data provided by Discogs.',
    },
    title: 'Another Chance',
    artists: [],
    labels: [],
    formats: [],
    barcodes: [],
    tracklist: [],
    identifiers: [],
    credits: [],
    draft: {
      title: 'Another Chance',
      genres: [],
      artistCredits: [],
      labels: [],
      tracklist: discogsTitles.map((title, position) => ({
        title,
        position: position + 1,
        artistCredits: [],
      })),
      externalSources: [],
    },
  }
  const trackMapping = buildDiscogsTrackMapping(
    currentTitles.map((title, index) => ({
      id: `track-${index + 1}`,
      title,
      fileName: `${String(index + 1).padStart(2, '0')} ${title}.m4a`,
      position: index + 1,
    })),
    detail.draft.tracklist,
  )
  const groups = {
    artists: false,
    classification: false,
    core: false,
    labels: false,
    tracklist: true,
  }
  const apply = (mapping: typeof trackMapping) =>
    applyDiscogsReleaseToImportDraft({
      artists: [],
      detail,
      dictionaries: defaultCatalogDictionaries,
      draft,
      groups,
      trackMapping: mapping,
    })
  return { apply, trackMapping }
}
