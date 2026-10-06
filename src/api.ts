import type { Conversation } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export interface HealthInfo {
  status: string
  service: string
  version: string
}

export const api = {
  health: () => request<HealthInfo>('/api/health'),

  listConversations: () => request<Conversation[]>('/api/conversations'),

  sendMessage: (message: string, conversationId: string | null) =>
    request<{ reply: string; conversation_id: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
    }),
}
