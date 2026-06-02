import { format, formatDistanceToNowStrict, isToday, parseISO } from 'date-fns'

export function niceDate(value: string) {
  return format(parseISO(value), 'EEE, d MMM')
}

export function niceTime(value: string) {
  return format(parseISO(value), 'h:mm a')
}

export function niceDateTime(value: string) {
  return format(parseISO(value), 'EEE, d MMM h:mm a')
}

export function relative(value: string) {
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true })
}

export function todayLabel(value: string) {
  return isToday(parseISO(value)) ? 'Today' : niceDate(value)
}

export function durationMinutes(startedAt: string, endedAt?: string) {
  const start = parseISO(startedAt).getTime()
  const end = endedAt ? parseISO(endedAt).getTime() : Date.now()
  return Math.max(0, Math.round((end - start) / 60000))
}

export function hoursAndMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

export function shortNumber(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
}
