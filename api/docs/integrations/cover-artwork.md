# Cover artwork source boundary

Import review supports one primary cover. Local scans, explicit file upload,
and explicit external selection all produce private application-owned bytes.
No audio is uploaded, source image files are not changed, and moving the source
folder does not invalidate a managed cover. Existing catalog covers are not
replaced by duplicate import confirmation.

## Explicit edition search

`Find cover` sends the entered artist, title, catalog number, and barcode to
MusicBrainz. It does not send local paths or a collection export. Incomplete
metadata is allowed: at least one search field must be provided. The collector
chooses a release edition, reviews its Cover Art Archive front images, and
explicitly selects one. Search and preview alone do not change the draft.

The integration deliberately does not use release-group artwork or borrow an
image from another edition. It does not scrape Discogs or use its restricted
image fields. The existing [Discogs boundary](discogs-autocomplete-boundary.md)
is unchanged. An absent front image is a valid empty result; local upload remains
available.

## Storage and failure behavior

A successful selection stores image bytes, not a remote URL dependency. Source
provenance includes provider, exact MusicBrainz release UUID, CAA image ID,
source page, download time, and SHA-256. Managed artifact metadata preserves it
without adding SQLite columns. New-release confirmation copies it to release
storage; reimport into an existing release retains that release's cover.

No existing selection is removed before the remote response has been downloaded
and validated. Offline, timeout, missing-image, malformed-response, and invalid
image failures are recoverable and leave the prior cover intact. Local metadata
saves cannot overwrite a later cover choice.

## Network boundary

The provider accepts release and image identifiers, not arbitrary URLs. Artwork
requests start at the CAA service after verifying image membership and front
classification for the selected edition. Every redirect and destination is
validated and automatic redirects are disabled. Connections use the standard
.NET transport, including platform DNS and proxy behavior, with normal TLS
certificate and hostname validation. Only HTTPS on port 443 at MusicBrainz,
CAA, and Internet Archive hosts is allowed; caller-supplied image URLs are not
accepted. The application does not classify resolved IP addresses or use
machine-specific network exceptions. This boundary prevents arbitrary URL and
redirect destinations, but does not independently prohibit a permitted hostname
from resolving to an internal network address. Server deployments that require
strict network isolation must enforce it at their egress boundary.
Transport warnings log error categories only, never exception messages, search
values, headers, or credentials.

JSON, image bytes, dimensions, redirects, and operation duration are
bounded. External images are capped at 10 MiB, previews at 2 MiB, and JSON
responses at 1 MiB. Supported rasters are JPEG, PNG, and nonanimated WebP, with
maximum dimensions of 12,000 pixels per edge and 40 million pixels total.
Validation checks raster framing and dimensions, not full image decoding.
Previews use the authenticated backend rather than embedding remote image URLs
into the renderer.

MusicBrainz requests share one process-wide request gate with metadata and
original-discovery operations, plus the contactable User-Agent configuration.
The gate owns each send until response headers or failure, then waits at least
one second before the next send. Monotonic timing avoids wall-clock changes;
concurrent calls and retries cannot bypass this cooldown. Cover redirects back
to MusicBrainz use the same gate. Separate running backend processes and other
applications do not share it. Cover search uses the official MusicBrainz HTTPS
endpoint, not a custom `MusicBrainz:BaseUrl` proxy. CAA does not currently specify
a rate limit, but service errors remain recoverable; this is not permission for unbounded background downloads.
No background search or bulk artwork harvesting runs.

## Rights and attribution

The UI identifies MusicBrainz / Cover Art Archive and links the exact source
page. CAA's editorial approval flag does not establish a copyright license.
Artwork rights remain with their holders; the availability of API metadata does
not make the image freely licensed. DiscWeave does not claim a general right to
republish artwork or silently add images to a public collection.

Primary references:

- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API)
- [Cover Art Archive policy](https://musicbrainz.org/doc/Cover_Art_Archive)
