import { useEffect, useRef, useState } from 'react'
import { loadRelease } from '../catalog/api/releaseClient'
import {
  searchDiscogsReleases,
  type DiscogsReleaseSearchParams,
} from '../catalog/api/externalMetadataClient'
import { rankDateCandidates, type DateSearchContext } from './releaseDateSearch'

export function useReleaseDateSearch(releaseId: string, initialTitle: string) {
  const [title, setTitle] = useState(initialTitle)
  const [artist, setArtist] = useState('')
  const [catalogNumber, setCatalogNumber] = useState('')
  const [context, setContext] = useState<DateSearchContext>({
    title: initialTitle,
    artists: [],
    catalogNumbers: [],
    labels: [],
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [candidates, setCandidates] = useState<ReturnType<
    typeof rankDateCandidates
  > | null>(null)
  const alive = useRef(true)
  const edited = useRef(false)
  const revision = useRef(0)
  useEffect(() => {
    alive.current = true
    let current = true
    void loadRelease(releaseId)
      .then((release) => {
        if (!current) return
        if (!release) throw new Error('Release unavailable')
        const artists = release.isVariousArtists
          ? []
          : [
              ...new Set(
                (release.artistCredits ?? [])
                  .filter((credit) =>
                    (
                      credit.roles ?? [credit.primaryRole ?? credit.role]
                    ).includes('mainArtist'),
                  )
                  .map((credit) => credit.artistName),
              ),
            ]
        const catalogNumbers = [
          ...new Set(
            (release.labels ?? [])
              .map((label) => label.catalogNumber?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        ]
        setContext({
          title: release.title,
          artists,
          catalogNumbers,
          labels: (release.labels ?? []).map((label) => label.name),
          year: release.year,
        })
        if (!edited.current) {
          setTitle(release.title)
          setArtist(artists.join(', '))
          setCatalogNumber(catalogNumbers[0] ?? '')
        }
      })
      .catch(() => {
        if (current)
          setLoadError(
            'Release details could not be loaded. Enter search details manually or use a Discogs release ID.',
          )
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
      alive.current = false
      revision.current += 1
    }
  }, [releaseId])
  function edit(field: 'title' | 'artist' | 'catalogNumber', value: string) {
    edited.current = true
    revision.current += 1
    setCandidates(null)
    setNotice('')
    if (field === 'title') setTitle(value)
    else if (field === 'artist') setArtist(value)
    else setCatalogNumber(value)
  }
  async function search(broad = false) {
    const version = ++revision.current
    setCandidates(null)
    setNotice('')
    const requests = dateSearchRequests(
      broad,
      title,
      artist,
      catalogNumber,
    ).map((request) => searchDiscogsReleases(request))
    if (!requests.length) return
    const results = await Promise.allSettled(requests)
    if (!alive.current || version !== revision.current) return
    const successful = results.filter((result) => result.status === 'fulfilled')
    if (!successful.length) {
      const failure = results.find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected' && failure.reason instanceof Error)
        throw failure.reason
      throw new Error(
        'Discogs search failed. Try again or enter an exact release ID.',
      )
    }
    if (successful.length < results.length)
      setNotice(
        'One search could not complete. These results are partial; retry to include both artist/title and catalog matches.',
      )
    const searchContext = {
      ...context,
      title: title.trim(),
      artists:
        artist.trim() && artist !== context.artists.join(', ')
          ? [artist.trim()]
          : context.artists,
      catalogNumbers: [
        ...new Set(
          [catalogNumber.trim(), ...context.catalogNumbers].filter(Boolean),
        ),
      ],
    }
    setCandidates(
      rankDateCandidates(
        successful.flatMap((result) => result.value.items),
        searchContext,
      ),
    )
  }
  return {
    title,
    artist,
    catalogNumber,
    context,
    loading,
    loadError,
    notice,
    candidates,
    edit,
    search,
  }
}

function dateSearchRequests(
  broad: boolean,
  title: string,
  artist: string,
  catalogNumber: string,
): DiscogsReleaseSearchParams[] {
  if (broad) return [{ title: title.trim(), limit: 25 }]
  const requests: DiscogsReleaseSearchParams[] = []
  if (title.trim() && artist.trim())
    requests.push({ title: title.trim(), artist: artist.trim(), limit: 25 })
  if (catalogNumber.trim())
    requests.push({ catalogNumber: catalogNumber.trim(), limit: 25 })
  return requests
}
