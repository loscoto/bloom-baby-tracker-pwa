import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { registerSW } from 'virtual:pwa-register'
import {
  Baby,
  CircleNotch,
  DownloadSimple,
  Drop,
  MoonStars,
  NotePencil,
  Plus,
  Ruler,
  Scales,
  ShieldCheck,
  Trash,
  UploadSimple,
  Waves,
  Heart,
} from '@phosphor-icons/react'
import clsx from 'clsx'
import { differenceInCalendarDays, format, isAfter, parseISO, subHours } from 'date-fns'
import { hoursAndMinutes, niceDate, niceDateTime, niceTime, relative, shortNumber, todayLabel } from './lib/format'
import { createEmptyState, exportState, isAppState, loadState, saveState } from './lib/store'
import type { AppState, BabyProfile, DiaperEntry, FeedingEntry, GrowthEntry, SleepEntry, EntryKind } from './types'

const kindMeta: Record<EntryKind, { label: string; icon: typeof MoonStars; accent: string }> = {
  sleep: { label: 'Sleep', icon: MoonStars, accent: 'var(--baby-accent)' },
  feed: { label: 'Feeding', icon: Baby, accent: 'var(--baby-accent-2)' },
  diaper: { label: 'Diaper', icon: Drop, accent: 'var(--baby-accent-3)' },
  growth: { label: 'Growth', icon: Scales, accent: 'var(--baby-accent-4)' },
}

const pastelThemes = [
  { bg: '#f1ebe4', accent: '#7d9c8d', accentSoft: '#e2ede7' },
  { bg: '#efeae4', accent: '#8f9fb3', accentSoft: '#e4ebf4' },
  { bg: '#f3eae8', accent: '#ad8e93', accentSoft: '#f1e2e4' },
  { bg: '#eff2ea', accent: '#849784', accentSoft: '#e3ece1' },
  { bg: '#edf0f4', accent: '#7a8fa1', accentSoft: '#e4ebf2' },
  { bg: '#f4efe4', accent: '#a69173', accentSoft: '#f0e7d7' },
] as const

const emptyBabies = (): BabyProfile[] => []

function nowInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function toIsoLocal(value: string) {
  return new Date(value).toISOString()
}

function createId() {
  return crypto.randomUUID()
}

function createBabyTheme(index: number) {
  return pastelThemes[index % pastelThemes.length]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function humanAge(birthday: string) {
  const days = differenceInCalendarDays(new Date(), parseISO(birthday))
  if (days <= 0) return 'Newborn'
  if (days < 30) return `${days} days old`
  const months = Math.floor(days / 30)
  const remaining = days % 30
  return remaining ? `${months} mo ${remaining} d` : `${months} months old`
}

function dayKey(value: string) {
  return format(parseISO(value), 'yyyy-MM-dd')
}

function entryMoment(entry: SleepEntry | FeedingEntry | DiaperEntry | GrowthEntry) {
  if ('startedAt' in entry) return parseISO(entry.startedAt).getTime()
  if ('occurredAt' in entry) return parseISO(entry.occurredAt).getTime()
  return parseISO(entry.measuredAt).getTime()
}

function iconLabel(value: DiaperEntry['output']) {
  return value === 'both' ? 'Wet + dirty' : value === 'wet' ? 'Wet' : 'Dirty'
}

function formatWeight(value?: number) {
  if (!value && value !== 0) return '—'
  return `${shortNumber(value)} kg`
}

function formatLength(value?: number) {
  if (!value && value !== 0) return '—'
  return `${shortNumber(value)} cm`
}

function sectionEntriesForBaby(state: AppState, babyId: string) {
  const sleep = state.sleep.filter((item) => item.babyId === babyId)
  const feedings = state.feedings.filter((item) => item.babyId === babyId)
  const diapers = state.diapers.filter((item) => item.babyId === babyId)
  const growth = state.growth.filter((item) => item.babyId === babyId)
  const combined = [
    ...sleep.map((item) => ({ type: 'sleep' as const, item })),
    ...feedings.map((item) => ({ type: 'feed' as const, item })),
    ...diapers.map((item) => ({ type: 'diaper' as const, item })),
    ...growth.map((item) => ({ type: 'growth' as const, item })),
  ]
    .sort((a, b) => entryMoment(b.item) - entryMoment(a.item))

  return { sleep, feedings, diapers, growth, combined }
}

function buildSparkPath(points: { x: number; y: number }[]) {
  if (!points.length) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function buildAreaPath(points: { x: number; y: number }[]) {
  if (!points.length) return ''
  const last = points[points.length - 1]
  const first = points[0]
  return `${buildSparkPath(points)} L ${last.x} 160 L ${first.x} 160 Z`
}

function Chart({
  growth,
  babyTheme,
}: {
  growth: GrowthEntry[]
  babyTheme: BabyProfile['theme']
}) {
  const weightPoints = growth
    .filter((item) => typeof item.weightKg === 'number')
    .slice(-8)
    .map((item, index, arr) => {
      const min = Math.min(...arr.map((entry) => entry.weightKg ?? 0))
      const max = Math.max(...arr.map((entry) => entry.weightKg ?? 0))
      const width = 520
      const x = arr.length === 1 ? width / 2 : (index / (arr.length - 1)) * width
      const y = 140 - ((item.weightKg! - min) / Math.max(1, max - min)) * 90
      return { x, y }
    })

  const lengthPoints = growth
    .filter((item) => typeof item.lengthCm === 'number')
    .slice(-8)
    .map((item, index, arr) => {
      const min = Math.min(...arr.map((entry) => entry.lengthCm ?? 0))
      const max = Math.max(...arr.map((entry) => entry.lengthCm ?? 0))
      const width = 520
      const x = arr.length === 1 ? width / 2 : (index / (arr.length - 1)) * width
      const y = 140 - ((item.lengthCm! - min) / Math.max(1, max - min)) * 90
      return { x, y }
    })

  const weightLatest = [...growth].reverse().find((item) => typeof item.weightKg === 'number')
  const lengthLatest = [...growth].reverse().find((item) => typeof item.lengthCm === 'number')

  return (
    <section className="panel panel-chart">
      <div className="section-head">
        <div>
          <p className="eyebrow">Growth</p>
          <h2>Soft lines for weight and length</h2>
        </div>
        <p className="section-copy">
          Gentle trending helps you spot the rhythm without turning the page into a spreadsheet.
        </p>
      </div>

      <div className="chart-shell" style={{ '--chart-accent': babyTheme.accent } as CSSProperties}>
        <svg viewBox="0 0 520 180" className="growth-chart" role="img" aria-label="Weight and length growth chart">
          <defs>
            <linearGradient id="weightGlow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={babyTheme.accent} stopOpacity="0.25" />
              <stop offset="100%" stopColor={babyTheme.accent} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lengthGlow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8ea0b3" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#8ea0b3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={buildAreaPath(weightPoints)} fill="url(#weightGlow)" />
          <path d={buildSparkPath(weightPoints)} fill="none" stroke={babyTheme.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={buildAreaPath(lengthPoints)} fill="url(#lengthGlow)" />
          <path d={buildSparkPath(lengthPoints)} fill="none" stroke="#8ea0b3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="chart-legend">
          <div>
            <span className="legend-dot" style={{ background: babyTheme.accent }} />
            <strong>Weight</strong>
            <span>{weightLatest ? `${formatWeight(weightLatest.weightKg)} · ${niceDate(weightLatest.measuredAt)}` : 'Add the first weigh-in'}</span>
          </div>
          <div>
            <span className="legend-dot legend-blue" />
            <strong>Length</strong>
            <span>{lengthLatest ? `${formatLength(lengthLatest.lengthCm)} · ${niceDate(lengthLatest.measuredAt)}` : 'Add the first measurement'}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [state, setState] = useState<AppState>(() => createEmptyState())
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [selectedKind, setSelectedKind] = useState<EntryKind>('sleep')
  const [importing, setImporting] = useState(false)
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateServiceWorker = useRef<null | ((reloadPage?: boolean) => Promise<void>)>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [babyDraft, setBabyDraft] = useState({
    name: '',
    birthday: nowInputValue(),
    notes: '',
  })
  const [sleepDraft, setSleepDraft] = useState({
    startedAt: nowInputValue(),
    endedAt: '',
    quality: 'restful' as SleepEntry['quality'],
    note: '',
  })
  const [feedDraft, setFeedDraft] = useState({
    startedAt: nowInputValue(),
    endedAt: '',
    method: 'breast' as FeedingEntry['method'],
    side: 'both' as FeedingEntry['side'],
    amountMl: '',
    note: '',
  })
  const [diaperDraft, setDiaperDraft] = useState({
    occurredAt: nowInputValue(),
    output: 'wet' as DiaperEntry['output'],
    rash: false,
    note: '',
  })
  const [growthDraft, setGrowthDraft] = useState({
    measuredAt: nowInputValue(),
    weightKg: '',
    lengthCm: '',
    note: '',
  })

  useEffect(() => {
    const dispose = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
    })
    updateServiceWorker.current = dispose
    return () => {
      updateServiceWorker.current = null
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let alive = true
    loadState().then((loaded) => {
      if (!alive) return
      setState(loaded)
      setHydrated(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setSaving(true)
    const timeout = window.setTimeout(() => {
      saveState(state)
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setSaving(false)
        })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [hydrated, state])

  useEffect(() => {
    if (state.babies.length && !state.selectedBabyId) {
      setState((current) => ({ ...current, selectedBabyId: current.babies[0].id }))
    }
    if (state.selectedBabyId && !state.babies.some((baby) => baby.id === state.selectedBabyId)) {
      setState((current) => ({ ...current, selectedBabyId: current.babies[0]?.id ?? null }))
    }
  }, [state.babies, state.selectedBabyId])

  const selectedBaby = useMemo(
    () => state.babies.find((baby) => baby.id === state.selectedBabyId) ?? state.babies[0] ?? null,
    [state.babies, state.selectedBabyId],
  )

  const babyData = useMemo(() => {
    if (!selectedBaby) return null
    return sectionEntriesForBaby(state, selectedBaby.id)
  }, [selectedBaby, state])

  const recentByDay = useMemo(() => {
    if (!babyData) return []
    const groups = new Map<string, typeof babyData.combined>()
    babyData.combined.forEach((entry) => {
      const key = dayKey(
        'startedAt' in entry.item
          ? entry.item.startedAt
          : 'occurredAt' in entry.item
            ? entry.item.occurredAt
            : entry.item.measuredAt,
      )
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(entry)
    })
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [babyData])

  const summaries = useMemo(() => {
    if (!selectedBaby || !babyData) return null
    const now = new Date()
    const since24h = subHours(now, 24)

    const sleepMinutes = babyData.sleep.reduce((total, item) => {
      const started = parseISO(item.startedAt)
      const ended = item.endedAt ? parseISO(item.endedAt) : now
      if (isAfter(started, since24h) || isAfter(ended, since24h)) {
        return total + Math.max(0, Math.round((ended.getTime() - started.getTime()) / 60000))
      }
      return total
    }, 0)

    const feedCount = babyData.feedings.filter((item) => isAfter(parseISO(item.startedAt), since24h)).length
    const diaperCount = babyData.diapers.filter((item) => isAfter(parseISO(item.occurredAt), since24h)).length

    const lastFeed = babyData.feedings[0] ?? null
    const lastSleep = babyData.sleep[0] ?? null
    const latestGrowth = babyData.growth[0] ?? null

    return {
      sleepMinutes,
      feedCount,
      diaperCount,
      lastFeed,
      lastSleep,
      latestGrowth,
      awakeMinutes:
        lastSleep && lastSleep.endedAt ? Math.max(0, Math.round((now.getTime() - parseISO(lastSleep.endedAt).getTime()) / 60000)) : null,
      age: humanAge(selectedBaby.birthday),
    }
  }, [babyData, selectedBaby])

  function selectBaby(id: string) {
    setState((current) => ({ ...current, selectedBabyId: id }))
  }

  function addBaby() {
    if (!babyDraft.name.trim()) return
    const baby: BabyProfile = {
      id: createId(),
      name: babyDraft.name.trim(),
      birthday: toIsoLocal(babyDraft.birthday),
      notes: babyDraft.notes.trim() || undefined,
      theme: createBabyTheme(state.babies.length),
    }
    setState((current) => ({
      ...current,
      babies: [baby, ...current.babies],
      selectedBabyId: baby.id,
    }))
    setBabyDraft({ name: '', birthday: nowInputValue(), notes: '' })
  }

  function removeBaby(id: string) {
    const baby = state.babies.find((item) => item.id === id)
    if (!baby) return
    if (!window.confirm(`Delete ${baby.name} and all of their logged data?`)) return
    setState((current) => ({
      ...current,
      babies: current.babies.filter((item) => item.id !== id),
      sleep: current.sleep.filter((item) => item.babyId !== id),
      feedings: current.feedings.filter((item) => item.babyId !== id),
      diapers: current.diapers.filter((item) => item.babyId !== id),
      growth: current.growth.filter((item) => item.babyId !== id),
      selectedBabyId: current.selectedBabyId === id ? current.babies.find((item) => item.id !== id)?.id ?? null : current.selectedBabyId,
    }))
  }

  function addEntry() {
    if (!selectedBaby) return

    if (selectedKind === 'sleep') {
      const sleep: SleepEntry = {
        id: createId(),
        babyId: selectedBaby.id,
        kind: 'sleep',
        startedAt: toIsoLocal(sleepDraft.startedAt),
        endedAt: sleepDraft.endedAt ? toIsoLocal(sleepDraft.endedAt) : undefined,
        quality: sleepDraft.quality,
        note: sleepDraft.note.trim() || undefined,
        createdAt: new Date().toISOString(),
      }
      setState((current) => ({ ...current, sleep: [sleep, ...current.sleep] }))
      setSleepDraft({ startedAt: nowInputValue(), endedAt: '', quality: 'restful', note: '' })
      return
    }

    if (selectedKind === 'feed') {
      const feed: FeedingEntry = {
        id: createId(),
        babyId: selectedBaby.id,
        kind: 'feed',
        startedAt: toIsoLocal(feedDraft.startedAt),
        endedAt: feedDraft.endedAt ? toIsoLocal(feedDraft.endedAt) : undefined,
        method: feedDraft.method,
        side: feedDraft.method === 'breast' ? feedDraft.side : undefined,
        amountMl: feedDraft.method === 'bottle' && feedDraft.amountMl ? Number(feedDraft.amountMl) : undefined,
        note: feedDraft.note.trim() || undefined,
        createdAt: new Date().toISOString(),
      }
      setState((current) => ({ ...current, feedings: [feed, ...current.feedings] }))
      setFeedDraft({ startedAt: nowInputValue(), endedAt: '', method: 'breast', side: 'both', amountMl: '', note: '' })
      return
    }

    if (selectedKind === 'diaper') {
      const diaper: DiaperEntry = {
        id: createId(),
        babyId: selectedBaby.id,
        kind: 'diaper',
        occurredAt: toIsoLocal(diaperDraft.occurredAt),
        output: diaperDraft.output,
        rash: diaperDraft.rash,
        note: diaperDraft.note.trim() || undefined,
        createdAt: new Date().toISOString(),
      }
      setState((current) => ({ ...current, diapers: [diaper, ...current.diapers] }))
      setDiaperDraft({ occurredAt: nowInputValue(), output: 'wet', rash: false, note: '' })
      return
    }

    if (selectedKind === 'growth') {
      const growth: GrowthEntry = {
        id: createId(),
        babyId: selectedBaby.id,
        kind: 'growth',
        measuredAt: toIsoLocal(growthDraft.measuredAt),
        weightKg: growthDraft.weightKg ? Number(growthDraft.weightKg) : undefined,
        lengthCm: growthDraft.lengthCm ? Number(growthDraft.lengthCm) : undefined,
        note: growthDraft.note.trim() || undefined,
        createdAt: new Date().toISOString(),
      }
      setState((current) => ({ ...current, growth: [growth, ...current.growth] }))
      setGrowthDraft({ measuredAt: nowInputValue(), weightKg: '', lengthCm: '', note: '' })
    }
  }

  function deleteEntry(kind: EntryKind, id: string) {
    setState((current) => ({
      ...current,
      [kind === 'sleep' ? 'sleep' : kind === 'feed' ? 'feedings' : kind === 'diaper' ? 'diapers' : 'growth']:
        kind === 'sleep'
          ? current.sleep.filter((item) => item.id !== id)
          : kind === 'feed'
            ? current.feedings.filter((item) => item.id !== id)
            : kind === 'diaper'
              ? current.diapers.filter((item) => item.id !== id)
              : current.growth.filter((item) => item.id !== id),
    }))
  }

  async function handleExport() {
    const payload = await exportState()
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `bloom-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function openImport() {
    fileInputRef.current?.click()
  }

  async function handleImport(file: File | null) {
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!isAppState(parsed)) {
        window.alert('That file does not look like a Bloom export.')
        return
      }
      if (!window.confirm('Importing will replace the data currently stored in this browser. Continue?')) return
      setState(parsed)
      setHydrated(true)
    } catch {
      window.alert('The file could not be read. Please import a valid JSON backup.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function forceSaveNow() {
    await saveState(state)
  }

  async function applyUpdate() {
    if (!updateServiceWorker.current) return
    await updateServiceWorker.current(true)
  }

  const currentBabyTheme = selectedBaby?.theme ?? pastelThemes[0]

  return (
    <div className="app-shell" style={{ '--baby-bg': currentBabyTheme.bg, '--baby-accent': currentBabyTheme.accent, '--baby-accent-2': '#8ea0b3', '--baby-accent-3': '#d28f95', '--baby-accent-4': '#97a883' } as CSSProperties}>
      <header className="topbar">
        <div className="brand-mark">
          <span className="brand-icon"><Heart weight="fill" /></span>
          <div>
            <strong>Bloom</strong>
            <span>Baby tracker that feels calm</span>
          </div>
        </div>

        <div className="topbar-actions">
          <span className={clsx('status-pill', online ? 'status-online' : 'status-offline')}>
            <ShieldCheck size={16} />
            {online ? 'Online' : 'Offline'}
          </span>
          <span className="status-pill subtle">
            <CircleNotch className={clsx('spinner', saving ? 'spinning' : '')} size={16} />
            {saving ? 'Saving' : hydrated ? 'Stored locally' : 'Loading'}
          </span>
          {needRefresh ? (
            <button className="ghost-button" onClick={applyUpdate}>
              Refresh app
            </button>
          ) : null}
          <button className="ghost-button" onClick={handleExport}>
            <DownloadSimple size={18} />
            Export
          </button>
          <button className="ghost-button" onClick={openImport}>
            <UploadSimple size={18} />
            Import
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(event) => handleImport(event.target.files?.[0] ?? null)} />
        </div>
      </header>

      <main className="page-grid">
        <aside className="sidebar panel">
          <div className="hero-copy">
            <p className="eyebrow">Offline-first PWA</p>
            <h1>
              Gentle tracking for feeds, naps, diapers, and growth.
            </h1>
            <p>
              Keep a calm, reliable record of the small things that help you spot patterns and support your baby’s rhythm.
            </p>
          </div>

          <div className="baby-stack">
            <div className="baby-stack-head">
              <h2>Babies</h2>
              <span>{state.babies.length}</span>
            </div>

            <div className="baby-list">
              {state.babies.length ? state.babies.map((baby) => {
                const active = baby.id === selectedBaby?.id
                return (
                  <button key={baby.id} className={clsx('baby-card', active && 'active')} onClick={() => selectBaby(baby.id)}>
                    <span className="baby-avatar" style={{ background: `linear-gradient(135deg, ${baby.theme.accentSoft}, ${baby.theme.bg})`, color: baby.theme.accent }}>
                      <Baby size={22} weight="fill" />
                    </span>
                    <span className="baby-info">
                      <strong>{baby.name}</strong>
                      <span>{humanAge(baby.birthday)}</span>
                    </span>
                    <span className="baby-badge">{baby.notes ? 'Notes' : 'Profile'}</span>
                  </button>
                )
              }) : (
                <div className="empty-card compact">
                  <Baby size={28} weight="fill" />
                  <strong>Add your first baby</strong>
                  <p>Create a profile to begin logging sleep, feeds, diapers, weight, and length.</p>
                </div>
              )}
            </div>

            <div className="inline-form">
              <h3>New profile</h3>
              <label>
                Name
                <input value={babyDraft.name} onChange={(event) => setBabyDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Mila" />
              </label>
              <label>
                Birthday
                <input type="datetime-local" value={babyDraft.birthday} onChange={(event) => setBabyDraft((current) => ({ ...current, birthday: event.target.value }))} />
              </label>
              <label>
                Notes
                <textarea value={babyDraft.notes} onChange={(event) => setBabyDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Feeding preferences, birth notes, helpful reminders." rows={4} />
              </label>
              <button className="primary-button" onClick={addBaby}>
                <Plus size={18} />
                Add baby
              </button>
            </div>
          </div>
        </aside>

        <section className="content">
          <section className="summary-grid">
            <article className="summary-card summary-hero panel">
              <div className="summary-head">
                <div>
                  <p className="eyebrow">Today</p>
                  <h2>{selectedBaby ? `Hello, ${selectedBaby.name}` : 'Welcome to Bloom'}</h2>
                </div>
                {selectedBaby ? (
                  <span className="baby-badge" style={{ color: selectedBaby.theme.accent, background: selectedBaby.theme.accentSoft }}>
                    Selected
                  </span>
                ) : null}
              </div>

              {selectedBaby && summaries ? (
                <div className="summary-metrics">
                  <div>
                    <span>Age</span>
                    <strong>{summaries.age}</strong>
                  </div>
                  <div>
                    <span>Sleep last 24h</span>
                    <strong>{hoursAndMinutes(summaries.sleepMinutes)}</strong>
                  </div>
                  <div>
                    <span>Feeds</span>
                    <strong>{summaries.feedCount}</strong>
                  </div>
                  <div>
                    <span>Diapers</span>
                    <strong>{summaries.diaperCount}</strong>
                  </div>
                </div>
              ) : (
                <div className="empty-card summary-empty">
                  <MoonStars size={30} weight="duotone" />
                  <strong>No baby selected yet</strong>
                  <p>Add a profile and the overview will turn into a living timeline.</p>
                </div>
              )}
            </article>

            <article className="summary-card metric-card panel">
              <div>
                <p className="metric-label">Last feed</p>
                <strong>{summaries?.lastFeed ? niceTime(summaries.lastFeed.startedAt) : '—'}</strong>
                <span>{summaries?.lastFeed ? `${summaries.lastFeed.method}${summaries.lastFeed.side ? ` · ${summaries.lastFeed.side}` : ''}` : 'Nothing logged yet'}</span>
              </div>
              <Baby size={28} weight="duotone" />
            </article>

            <article className="summary-card metric-card panel">
              <div>
                <p className="metric-label">Last sleep</p>
                <strong>{summaries?.lastSleep ? todayLabel(summaries.lastSleep.startedAt) : '—'}</strong>
                <span>{summaries?.lastSleep ? `${hoursAndMinutes(summaries.lastSleep.endedAt ? Math.round((parseISO(summaries.lastSleep.endedAt).getTime() - parseISO(summaries.lastSleep.startedAt).getTime()) / 60000) : 0)} · ${summaries.lastSleep.quality}` : 'Nothing logged yet'}</span>
              </div>
              <MoonStars size={28} weight="duotone" />
            </article>
          </section>

          <section className="composer panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Quick log</p>
                <h2>Capture the moment in one breath</h2>
              </div>
              <p className="section-copy">
                Switch between sleep, feeding, diaper, and growth entries without losing your place.
              </p>
            </div>

            <div className="composer-tabs" role="tablist" aria-label="Entry type">
              {(Object.entries(kindMeta) as [EntryKind, (typeof kindMeta)[EntryKind]][]).map(([kind, meta]) => {
                const Icon = meta.icon
                const active = selectedKind === kind
                return (
                  <button key={kind} className={clsx('tab-button', active && 'active')} onClick={() => setSelectedKind(kind)}>
                    <Icon size={18} />
                    {meta.label}
                  </button>
                )
              })}
            </div>

            <div className="composer-grid">
              {selectedKind === 'sleep' ? (
                <div className="form-grid">
                  <label>
                    Started
                    <input type="datetime-local" value={sleepDraft.startedAt} onChange={(event) => setSleepDraft((current) => ({ ...current, startedAt: event.target.value }))} />
                  </label>
                  <label>
                    Ended
                    <input type="datetime-local" value={sleepDraft.endedAt} onChange={(event) => setSleepDraft((current) => ({ ...current, endedAt: event.target.value }))} />
                  </label>
                  <label>
                    Quality
                    <select value={sleepDraft.quality} onChange={(event) => setSleepDraft((current) => ({ ...current, quality: event.target.value as SleepEntry['quality'] }))}>
                      <option value="restful">Restful</option>
                      <option value="fussy">Fussy</option>
                      <option value="short">Short</option>
                    </select>
                  </label>
                  <label className="span-2">
                    Note
                    <textarea value={sleepDraft.note} onChange={(event) => setSleepDraft((current) => ({ ...current, note: event.target.value }))} placeholder="How did the nap feel?" rows={3} />
                  </label>
                </div>
              ) : null}

              {selectedKind === 'feed' ? (
                <div className="form-grid">
                  <label>
                    Started
                    <input type="datetime-local" value={feedDraft.startedAt} onChange={(event) => setFeedDraft((current) => ({ ...current, startedAt: event.target.value }))} />
                  </label>
                  <label>
                    Ended
                    <input type="datetime-local" value={feedDraft.endedAt} onChange={(event) => setFeedDraft((current) => ({ ...current, endedAt: event.target.value }))} />
                  </label>
                  <label>
                    Method
                    <select value={feedDraft.method} onChange={(event) => setFeedDraft((current) => ({ ...current, method: event.target.value as FeedingEntry['method'] }))}>
                      <option value="breast">Breast</option>
                      <option value="bottle">Bottle</option>
                    </select>
                  </label>
                  {feedDraft.method === 'breast' ? (
                    <label>
                      Side
                      <select value={feedDraft.side} onChange={(event) => setFeedDraft((current) => ({ ...current, side: event.target.value as FeedingEntry['side'] }))}>
                        <option value="both">Both</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                  ) : (
                    <label>
                      Amount (ml)
                      <input inputMode="decimal" value={feedDraft.amountMl} onChange={(event) => setFeedDraft((current) => ({ ...current, amountMl: event.target.value }))} placeholder="90" />
                    </label>
                  )}
                  <label className="span-2">
                    Note
                    <textarea value={feedDraft.note} onChange={(event) => setFeedDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Latch, appetite, burp, bottle details." rows={3} />
                  </label>
                </div>
              ) : null}

              {selectedKind === 'diaper' ? (
                <div className="form-grid">
                  <label>
                    Time
                    <input type="datetime-local" value={diaperDraft.occurredAt} onChange={(event) => setDiaperDraft((current) => ({ ...current, occurredAt: event.target.value }))} />
                  </label>
                  <label>
                    Type
                    <select value={diaperDraft.output} onChange={(event) => setDiaperDraft((current) => ({ ...current, output: event.target.value as DiaperEntry['output'] }))}>
                      <option value="wet">Wet</option>
                      <option value="dirty">Dirty</option>
                      <option value="both">Wet + dirty</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={diaperDraft.rash} onChange={(event) => setDiaperDraft((current) => ({ ...current, rash: event.target.checked }))} />
                    Rash or irritation noted
                  </label>
                  <label className="span-2">
                    Note
                    <textarea value={diaperDraft.note} onChange={(event) => setDiaperDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Texture, color, diaper cream, anything useful." rows={3} />
                  </label>
                </div>
              ) : null}

              {selectedKind === 'growth' ? (
                <div className="form-grid">
                  <label>
                    Measured
                    <input type="datetime-local" value={growthDraft.measuredAt} onChange={(event) => setGrowthDraft((current) => ({ ...current, measuredAt: event.target.value }))} />
                  </label>
                  <label>
                    Weight (kg)
                    <input inputMode="decimal" value={growthDraft.weightKg} onChange={(event) => setGrowthDraft((current) => ({ ...current, weightKg: event.target.value }))} placeholder="3.4" />
                  </label>
                  <label>
                    Length (cm)
                    <input inputMode="decimal" value={growthDraft.lengthCm} onChange={(event) => setGrowthDraft((current) => ({ ...current, lengthCm: event.target.value }))} placeholder="52" />
                  </label>
                  <label className="span-2">
                    Note
                    <textarea value={growthDraft.note} onChange={(event) => setGrowthDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Weigh-in context, clinic notes, clothing state." rows={3} />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="composer-footer">
              <p>
                {selectedBaby ? `Logging for ${selectedBaby.name}` : 'Create a profile first.'}
              </p>
              <button className="primary-button" onClick={addEntry} disabled={!selectedBaby}>
                <Plus size={18} />
                Add {kindMeta[selectedKind].label.toLowerCase()}
              </button>
            </div>
          </section>

          <div className="lower-grid">
            <Chart growth={babyData?.growth ?? []} babyTheme={currentBabyTheme} />

            <section className="panel insights-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Insight</p>
                  <h2>Fast at-a-glance notes</h2>
                </div>
                <p className="section-copy">Helpful context based on the latest logs for the selected baby.</p>
              </div>

              <div className="insight-list">
                <article>
                  <Waves size={20} />
                  <div>
                    <strong>Awake time</strong>
                    <span>{summaries?.awakeMinutes != null ? `${hoursAndMinutes(summaries.awakeMinutes)} since last sleep ended` : 'Add a sleep entry to see wake windows'}</span>
                  </div>
                </article>
                <article>
                  <Baby size={20} />
                  <div>
                    <strong>Last feed</strong>
                    <span>{summaries?.lastFeed ? `${relative(summaries.lastFeed.startedAt)} · ${summaries.lastFeed.method}` : 'No feed logged yet'}</span>
                  </div>
                </article>
                <article>
                  <Ruler size={20} />
                  <div>
                    <strong>Latest growth</strong>
                    <span>{summaries?.latestGrowth ? `${formatWeight(summaries.latestGrowth.weightKg)} · ${formatLength(summaries.latestGrowth.lengthCm)}` : 'Add weight and length from the clinic or home scale'}</span>
                  </div>
                </article>
              </div>
            </section>
          </div>

          <section className="panel timeline-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Timeline</p>
                <h2>Everything in one calm stream</h2>
              </div>
              <p className="section-copy">
                {selectedBaby ? 'Recent logs for the selected baby, grouped by day.' : 'Add a baby and the timeline will appear here.'}
              </p>
            </div>

            {!selectedBaby ? (
              <div className="empty-card timeline-empty">
                <NotePencil size={30} weight="duotone" />
                <strong>Nothing to show yet</strong>
                <p>Once you create a profile, the logs will appear here in a neat chronological stream.</p>
              </div>
            ) : babyData?.combined.length ? (
              <div className="timeline-groups">
                {recentByDay.map(([groupDay, items]) => (
                  <article key={groupDay} className="timeline-group">
                    <div className="timeline-day">
                      <strong>{format(parseISO(groupDay), 'EEEE')}</strong>
                      <span>{format(parseISO(groupDay), 'd MMM yyyy')}</span>
                    </div>
                    <div className="timeline-items">
                      {items.map(({ type, item }) => {
                        const Icon = kindMeta[type].icon
                        return (
                          <div key={item.id} className={clsx('timeline-item', type)}>
                            <div className="timeline-icon">
                              <Icon size={18} weight="duotone" />
                            </div>
                            <div className="timeline-content">
                              <div className="timeline-topline">
                                <strong>{kindMeta[type].label}</strong>
                                <span>
                                  {'startedAt' in item
                                    ? niceTime(item.startedAt)
                                    : 'occurredAt' in item
                                      ? niceTime(item.occurredAt)
                                      : niceTime(item.measuredAt)}
                                </span>
                              </div>
                              <p>
                                {type === 'sleep'
                                  ? `${hoursAndMinutes(Math.max(0, Math.round((parseISO(item.endedAt ?? new Date().toISOString()).getTime() - parseISO(item.startedAt).getTime()) / 60000)))} · ${item.quality}${item.note ? ` · ${item.note}` : ''}`
                                  : type === 'feed'
                                    ? `${item.method}${item.side ? ` · ${item.side}` : ''}${item.amountMl ? ` · ${item.amountMl} ml` : ''}${item.note ? ` · ${item.note}` : ''}`
                                    : type === 'diaper'
                                      ? `${iconLabel(item.output)}${item.rash ? ' · Rash noted' : ''}${item.note ? ` · ${item.note}` : ''}`
                                      : `${formatWeight(item.weightKg)} · ${formatLength(item.lengthCm)}${item.note ? ` · ${item.note}` : ''}`}
                              </p>
                            </div>
                            <button className="icon-button" onClick={() => deleteEntry(type, item.id)} aria-label={`Delete ${kindMeta[type].label.toLowerCase()} entry`}>
                              <Trash size={16} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-card timeline-empty">
                <NotePencil size={30} weight="duotone" />
                <strong>No logs yet</strong>
                <p>Use the quick log panel to add the first sleep, feed, diaper, or growth entry.</p>
              </div>
            )}
          </section>

          <section className="footer-actions panel">
            <div>
              <p className="eyebrow">Backup</p>
              <h2>Move between browsers without losing a single note</h2>
            </div>
            <div className="footer-copy">
              <p>
                Export creates a JSON backup. Import replaces the current browser store with the file you choose.
              </p>
              <button className="secondary-button" onClick={forceSaveNow}>Save now</button>
            </div>
          </section>
        </section>
      </main>

      {importing ? <div className="importing-toast">Reading backup…</div> : null}
    </div>
  )
}

export default App
