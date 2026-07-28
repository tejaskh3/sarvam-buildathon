/* Shapes the family API returns. They mirror what app/server.js sends, so a
   change on the server lands in exactly one file here. */

export type Person = { id: number; name: string; memory_count: number; lang: string | null }
export type Memory = {
  id: number; statement: string; canonical: string; category: string
  emotional_tone: string; provenance: string; status: string; safe_to_use: number
  audio_file: string | null; created_at: string; visit_count: number
  prov_history: string | null
  variants: { id: number; statement: string; created_at: string }[]
}
export type Briefing = {
  ask_about: string[]; wants_to_finish: string | null
  avoid_today: string[]; new_this_week: string | null
}
export type Memoir = {
  title: string; title_translated?: string | null
  paragraphs: { text: string; translated?: string | null; source_memories: { id: number; statement: string; audio_file: string | null }[] }[]
}
export type Photo = {
  id: number; url: string; event: string; place: string; year: string
  status: string; people: { name: string; relation?: string; deceased: boolean }[]
}
export type Reminder = {
  id: number; text: string; time_of_day: string; active: number
  mention_count: number; ack_count: number
}
export type ScribeReport = {
  summary: string; mood: string; topics: string[]
  recall_moments: { type: 'fluent' | 'needed_help'; quote: string }[]
  red_flags: string[]; for_doctor: string
  duration_min?: number; language?: string | null
}
export type ScribeRow = {
  id: string; facilitator: string | null; status: string; seconds: number
  created_at: string; report: ScribeReport | null
}
export type Engagement = {
  rounds: { theme: string; detail: string; items: number | null; enjoyed: number | null; created_at: string }[]
  fluency_trend: { at: string; items: number }[]
}
export type Signals = {
  alerts: { question: string; answer: string; delay_ms: number; created_at: string; severity: 'high' | 'medium' }[]
  fading: { id: number; statement: string; canonical: string; visit_count: number }[]
  series: { session_id: string; at: string; turns: number; avg_delay_ms: number; max_delay_ms: number; slow_turns: number; captured: number }[]
  thresholds: { slow_ms: number; very_slow_ms: number }
}

export type CheckinEvent = {
  id: number
  kind: 'missed' | 'resumed' | 'dialled' | 'dial_failed'
  detail: string | null
  hours_quiet: number | null
  created_at: string
}
export type CheckinStatus = {
  schedule: { every_hours: number; quiet_from: number; quiet_to: number; active: boolean }
  hours_quiet: number
  overdue: boolean
  hours_until_due: number
  dialing_enabled: boolean
  events: CheckinEvent[]
}
