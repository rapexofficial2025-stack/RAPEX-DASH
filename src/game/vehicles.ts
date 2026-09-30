// Vehicle progression: higher rider level unlocks faster vehicles.

export interface Vehicle {
  id: string
  name: string
  color: number // hex color used in the 3D scene
  css: string // same color for the menu UI
  unlockLevel: number
  baseSpeed: number
  lateral: number // how quickly it changes lanes
  boostMult: number
  blurb: string
}

export const VEHICLES: Vehicle[] = [
  {
    id: 'scooter',
    name: 'Rapex Scooter',
    color: 0x00e5ff,
    css: '#00e5ff',
    unlockLevel: 1,
    baseSpeed: 18,
    lateral: 10,
    boostMult: 1.5,
    blurb: 'Reliable starter ride.',
  },
  {
    id: 'sport',
    name: 'Sport Bike',
    color: 0xff2e9a,
    css: '#ff2e9a',
    unlockLevel: 3,
    baseSpeed: 22,
    lateral: 13,
    boostMult: 1.6,
    blurb: 'Faster and sharper turns.',
  },
  {
    id: 'hopper',
    name: 'Cyber Hopper',
    color: 0xffc93c,
    css: '#ffc93c',
    unlockLevel: 5,
    baseSpeed: 26,
    lateral: 16,
    boostMult: 1.8,
    blurb: 'The legendary rabbit machine.',
  },
]
