export interface Conversation {
  id: string
  title: string
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
}

export type BackendStatus = 'checking' | 'online' | 'offline'
