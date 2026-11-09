import { useSyncExternalStore } from 'react'

export type Route = { name: 'library' } | { name: 'course'; id: string; lesson?: string }

function parse(hash: string): Route {
  const m = hash.match(/^#\/course\/([^/?]+)(?:\/([^/?]+))?/)
  if (m) return { name: 'course', id: decodeURIComponent(m[1]), lesson: m[2] ? decodeURIComponent(m[2]) : undefined }
  return { name: 'library' }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parse(hash)
}

export function navigate(to: string) {
  window.location.hash = to
}

export const coursePath = (id: string) => `#/course/${encodeURIComponent(id)}`
