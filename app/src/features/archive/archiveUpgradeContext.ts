import { createContext, useContext } from 'react'

export const ArchiveUpgradeContext = createContext<
  null | (() => Promise<boolean>)
>(null)

export function useArchiveUpgrade() {
  return useContext(ArchiveUpgradeContext)
}
