import type { Course, Note } from '../types'
import { clock } from './format'
import { watchUrl } from './youtube'

export function notesToMarkdown(course: Course, notes: Note[]): string {
  const lines = [`# ${course.title}`, '', `Source: ${course.sourceUrl}`, '']
  for (const l of course.lessons) {
    const ns = notes.filter((n) => n.lessonId === l.id).sort((a, b) => a.t - b.t)
    if (!ns.length) continue
    lines.push(`## ${l.title}`, '')
    for (const n of ns) {
      const tag = n.kind === 'recall' ? ' (recall)' : n.kind === 'bookmark' ? ' (bookmark)' : ''
      lines.push(`- [${clock(n.t)}](${watchUrl(l.videoId, n.t)})${tag} ${n.text}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
