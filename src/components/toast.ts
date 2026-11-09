import { create } from 'zustand'

interface Toast {
  id: number
  text: string
  tone: 'focus' | 'rest' | 'plain'
}

export const useToasts = create<{ items: Toast[]; push(text: string, tone?: Toast['tone']): void }>()((set) => ({
  items: [],
  push(text, tone = 'plain') {
    const id = Date.now() + Math.random()
    set((s) => ({ items: [...s.items.slice(-2), { id, text, tone }] }))
    window.setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3800)
  },
}))

export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().push(text, tone)

