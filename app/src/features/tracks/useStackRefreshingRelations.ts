import { useEffect, useRef } from 'react'
import type { RelationMutationProps } from '../relations/RelationManagerDialog'

export function useStackRefreshingRelations(
  callbacks: RelationMutationProps,
  refresh: () => void,
): RelationMutationProps {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  function afterSave<T>(
    callback: ((value: T) => Promise<boolean>) | undefined,
  ) {
    if (!callback) return undefined
    return async (value: T) => {
      const saved = await callback(value)
      if (saved && mounted.current) refresh()
      return saved
    }
  }
  return {
    onAddRelation: afterSave(callbacks.onAddRelation),
    onUpdateRelation: afterSave(callbacks.onUpdateRelation),
    onDeleteRelation: afterSave(callbacks.onDeleteRelation),
  }
}
