// Saves progress in the player's own browser (no backend needed for the demo).

export interface SaveData {
  best: number
  totalXp: number
  earnings: number
  vehicle: string
}

const KEY = 'rapex-dash-save-v1'
const DEFAULT: SaveData = { best: 0, totalXp: 0, earnings: 0, vehicle: 'scooter' }
export const XP_PER_LEVEL = 300

export const levelFor = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Private mode or blocked storage: the game still works, it just won't remember.
  }
}
