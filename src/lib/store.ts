import * as localforage from 'localforage'
import type { AppState } from '../types'

export const STORAGE_KEY = 'bloom:state:v1'

const db = localforage.createInstance({
  name: 'bloom-baby-tracker',
  storeName: 'app_state',
})

export const createEmptyState = (): AppState => ({
  version: 1,
  selectedBabyId: null,
  babies: [],
  sleep: [],
  feedings: [],
  diapers: [],
  growth: [],
})

export async function loadState(): Promise<AppState> {
  const value = await db.getItem<AppState>(STORAGE_KEY)
  if (!value || value.version !== 1) {
    return createEmptyState()
  }

  return {
    ...createEmptyState(),
    ...value,
    babies: Array.isArray(value.babies) ? value.babies : [],
    sleep: Array.isArray(value.sleep) ? value.sleep : [],
    feedings: Array.isArray(value.feedings) ? value.feedings : [],
    diapers: Array.isArray(value.diapers) ? value.diapers : [],
    growth: Array.isArray(value.growth) ? value.growth : [],
  }
}

export async function saveState(state: AppState): Promise<void> {
  await db.setItem(STORAGE_KEY, state)
}

export async function clearState(): Promise<void> {
  await db.removeItem(STORAGE_KEY)
}

export async function exportState(): Promise<string> {
  const state = await loadState()
  return JSON.stringify(state, null, 2)
}

export function isAppState(input: unknown): input is AppState {
  if (!input || typeof input !== 'object') return false
  const value = input as Partial<AppState>
  return value.version === 1 && Array.isArray(value.babies)
}
