import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { Library } from './pages/Library'
import { CoursePage } from './pages/CoursePage'
import { Toaster } from './components/ui'
import { useStore } from './store/useStore'

export default function App() {
  const route = useRoute()
  const theme = useStore((s) => s.settings.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route.name])

  return (
    <>
      {route.name === 'course' ? <CoursePage key={route.id} courseId={route.id} /> : <Library />}
      <Toaster />
    </>
  )
}
