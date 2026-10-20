'use client'
import { useCallback, useEffect, useState } from 'react'
import { loadRegistrySecrets, type RegistryLoad } from '@/lib/secret-insights'

/** Loads real dashboard data for secrets created in this browser. */
export function useRegistrySecrets() {
  const [state, setState] = useState<{ status: 'loading' | 'ready'; data: RegistryLoad }>({ status: 'loading', data: { loaded: [], failed: [], registered: 0 } })
  const reload = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }))
    setState({ status: 'ready', data: await loadRegistrySecrets() })
  }, [])
  useEffect(() => { void reload() }, [reload])
  return { ...state, reload }
}
