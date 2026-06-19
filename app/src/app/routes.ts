import {
  Album,
  Archive,
  Boxes,
  ClipboardCheck,
  FileDown,
  FolderInput,
  GitBranch,
  ListPlus,
  ListMusic,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type AppRoutePath =
  | '/catalog'
  | '/releases'
  | '/tracks'
  | '/artists'
  | '/labels'
  | '/playlists'
  | '/owned-items'
  | '/review-workbench'
  | '/relations'
  | '/imports'
  | '/exports'
  | '/settings'

export type AppRoute = {
  path: AppRoutePath
  label: string
  description: string
  actionLabel?: string
  icon: LucideIcon
}

export const appRoutes = [
  {
    path: '/catalog',
    label: 'Catalog',
    description:
      'Search releases, tracks, media, ownership, credits and relations.',
    actionLabel: 'Add entry',
    icon: Archive,
  },
  {
    path: '/releases',
    label: 'Releases',
    description: 'Release records by format, year, label and status.',
    actionLabel: 'Add release',
    icon: Album,
  },
  {
    path: '/tracks',
    label: 'Tracks',
    description: 'Track-level credits, versions and local files.',
    actionLabel: 'Add track',
    icon: ListMusic,
  },
  {
    path: '/artists',
    label: 'Artists',
    description: 'People, bands, aliases and collectives in the archive.',
    actionLabel: 'Add artist',
    icon: Users,
  },
  {
    path: '/labels',
    label: 'Labels',
    description: 'Label catalogs, releases and owned coverage.',
    actionLabel: 'Add label',
    icon: Tags,
  },
  {
    path: '/playlists',
    label: 'Playlists',
    description: 'Manual and smart catalog lists by tags, media and ownership.',
    actionLabel: 'Add playlist',
    icon: ListPlus,
  },
  {
    path: '/owned-items',
    label: 'Owned Items',
    description:
      'Physical and digital copies with condition, storage and ownership state.',
    actionLabel: 'Add owned item',
    icon: Boxes,
  },
  {
    path: '/review-workbench',
    label: 'Review Workbench',
    description:
      'Review collection problems, triage cleanup work, and navigate to existing catalog surfaces.',
    icon: ClipboardCheck,
  },
  {
    path: '/relations',
    label: 'Relations',
    description: 'Aliases, memberships, collaborations, remixes and versions.',
    actionLabel: 'Add relation',
    icon: GitBranch,
  },
  {
    path: '/imports',
    label: 'Imports',
    description: 'Local folder scans and metadata intake.',
    icon: FolderInput,
  },
  {
    path: '/exports',
    label: 'Exports',
    description: 'Portable snapshots for collection data.',
    icon: FileDown,
  },
  {
    path: '/settings',
    label: 'Settings',
    description: 'Collection defaults and archive preferences.',
    icon: Settings,
  },
] satisfies AppRoute[]

export function resolveRoute(pathname: string) {
  const normalizedPath = normalizePath(pathname)

  return (
    appRoutes.find((route) => route.path === normalizedPath) ?? appRoutes[0]
  )
}

export function isAppRoutePath(pathname: string): pathname is AppRoutePath {
  const normalizedPath = normalizePath(pathname)

  return appRoutes.some((route) => route.path === normalizedPath)
}

function normalizePath(pathname: string) {
  const path = pathname.replace(/\/+$/, '') || '/catalog'

  return path
}
