import type { ReleaseCoverImage } from './releasesData'

type ReleaseCoverThumbnailProps = {
  coverImage?: ReleaseCoverImage
  title: string
}

export function ReleaseCoverThumbnail({
  coverImage,
  title,
}: ReleaseCoverThumbnailProps) {
  if (coverImage) {
    return (
      <span className="release-cover-thumbnail">
        <img
          alt={`${title} cover thumbnail`}
          decoding="async"
          loading="lazy"
          src={coverImage.url}
        />
      </span>
    )
  }

  return (
    <span
      aria-label={`No cover image recorded for ${title}`}
      className="release-cover-thumbnail release-cover-thumbnail-empty"
      role="img"
    >
      <span aria-hidden="true" className="release-cover-thumbnail-mark" />
    </span>
  )
}
