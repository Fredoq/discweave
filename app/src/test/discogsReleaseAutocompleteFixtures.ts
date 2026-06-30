export function source(externalId: string) {
  return {
    providerName: 'discogs',
    resourceType: 'release',
    externalId,
    sourceUrl: `https://www.discogs.com/release/${externalId}`,
    attribution: 'Data provided by Discogs.',
  }
}

export function releaseDetail() {
  return {
    source: source('249504'),
    title: 'Blue Monday',
    artists: ['New Order'],
    year: 1983,
    labels: ['Factory'],
    formats: ['Vinyl', '12"'],
    tracklist: [
      {
        title: 'Blue Monday',
        position: 'A',
        disc: 'Factory 12-inch',
        side: 'A',
        durationSeconds: 449,
        artists: ['New Order'],
      },
    ],
    identifiers: [{ type: 'Barcode', value: '5016839200371' }],
    barcodes: ['5016839200371'],
    catalogNumber: 'FAC 73',
    credits: [{ name: 'New Order', role: 'Written-By' }],
    draft: {
      title: 'Blue Monday',
      type: 'single',
      genres: ['Electronic', 'Leftfield'],
      year: 1983,
      releaseDate: '1983-03-07',
      artistCredits: [{ name: 'New Order', role: 'mainArtist' }],
      labels: [
        {
          name: 'Factory',
          catalogNumber: 'FAC 73',
          hasNoCatalogNumber: false,
        },
      ],
      tracklist: [
        {
          title: 'Blue Monday',
          position: 1,
          disc: 'Factory 12-inch',
          side: 'A',
          durationSeconds: 449,
          artistCredits: [
            { name: 'New Order', role: 'mainArtist' },
            { name: 'New Order', role: 'Written-By' },
          ],
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: '249504',
          sourceUrl: 'https://www.discogs.com/release/249504',
        },
      ],
    },
  }
}

export function compilationReleaseDetail() {
  return {
    source: source('orb-1991'),
    title: "The Orb's Adventures Beyond The Ultraworld",
    artists: ['The Orb'],
    year: 1991,
    labels: ['Big Life'],
    formats: ['CD', 'Album'],
    tracklist: [],
    identifiers: [{ type: 'Barcode', value: '042284796323' }],
    barcodes: ['042284796323'],
    catalogNumber: 'BLRCD 5',
    credits: [],
    draft: {
      title: "The Orb's Adventures Beyond The Ultraworld",
      genres: ['Electronic'],
      year: 1991,
      artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
      labels: [
        {
          name: 'Big Life',
          catalogNumber: 'BLRCD 5',
          hasNoCatalogNumber: false,
        },
      ],
      tracklist: [
        {
          title: 'Little Fluffy Clouds',
          position: 1,
          disc: 'Orbit Compact Disc',
          side: 'A',
          durationSeconds: 269,
          artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
        },
        {
          title: 'Earth (Gaia)',
          position: 2,
          disc: 'Orbit Compact Disc',
          side: 'A',
          durationSeconds: 580,
          artistCredits: [
            { name: 'The Orb', role: 'mainArtist' },
            { name: 'Andy Falconer', role: 'engineer' },
          ],
        },
        {
          title: 'Perpetual Dawn',
          position: 3,
          disc: 'Orbit Compact Disc',
          side: 'B',
          durationSeconds: 568,
          artistCredits: [
            { name: 'The Orb', role: 'mainArtist' },
            { name: 'Steve Hillage', role: 'Guitar' },
            { name: 'Steve Hillage', role: 'Producer' },
          ],
        },
        {
          title: 'Back Side Of The Moon',
          position: 4,
          disc: 'Ultraworld Index',
          side: 'C',
          durationSeconds: 826,
          artistCredits: [{ name: 'Thomas Fehlmann', role: 'mainArtist' }],
        },
        {
          title: 'Into The Fourth Dimension',
          position: 5,
          disc: 'Ultraworld Index',
          side: 'D',
          durationSeconds: 572,
          artistCredits: [{ name: 'The Orb', role: 'mainArtist' }],
        },
      ],
      externalSources: [
        {
          providerName: 'discogs',
          resourceType: 'release',
          externalId: 'orb-1991',
          sourceUrl: 'https://www.discogs.com/release/orb-1991',
        },
      ],
    },
  }
}
