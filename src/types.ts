export type BabyTheme = {
  bg: string
  accent: string
  accentSoft: string
}

export type BabyProfile = {
  id: string
  name: string
  birthday: string
  notes?: string
  theme: BabyTheme
}

export type SleepEntry = {
  id: string
  babyId: string
  kind: 'sleep'
  startedAt: string
  endedAt?: string
  quality: 'restful' | 'fussy' | 'short'
  note?: string
  createdAt: string
}

export type FeedingEntry = {
  id: string
  babyId: string
  kind: 'feed'
  startedAt: string
  endedAt?: string
  method: 'breast' | 'bottle'
  side?: 'left' | 'right' | 'both'
  amountMl?: number
  note?: string
  createdAt: string
}

export type DiaperEntry = {
  id: string
  babyId: string
  kind: 'diaper'
  occurredAt: string
  output: 'wet' | 'dirty' | 'both'
  rash?: boolean
  note?: string
  createdAt: string
}

export type GrowthEntry = {
  id: string
  babyId: string
  kind: 'growth'
  measuredAt: string
  weightKg?: number
  lengthCm?: number
  note?: string
  createdAt: string
}

export type TrackerEntry = SleepEntry | FeedingEntry | DiaperEntry | GrowthEntry

export type AppState = {
  version: 1
  selectedBabyId: string | null
  babies: BabyProfile[]
  sleep: SleepEntry[]
  feedings: FeedingEntry[]
  diapers: DiaperEntry[]
  growth: GrowthEntry[]
}

export type EntryKind = TrackerEntry['kind']
