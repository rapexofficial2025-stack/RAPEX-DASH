import { VEHICLES } from '../game/vehicles'
import { XP_PER_LEVEL, type SaveData } from '../game/storage'

interface Props {
  save: SaveData
  level: number
  selected: string
  onSelect: (id: string) => void
  onStart: () => void
}

export default function Menu({ save, level, selected, onSelect, onStart }: Props) {
  const inLevel = save.totalXp % XP_PER_LEVEL

  return (
    <div className="overlay">
      <div className="panel">
        <p className="kicker">INTERACTIVE WEB GAME</p>
        <h1 className="title">
          RAPEX <span>DASH</span>
        </h1>
        <p className="sub">
          Neon courier runner. Grab parcels, dodge traffic, deliver to earn XP and unlock new
          vehicles.
        </p>

        <div className="rider-row">
          <span className="lv">LV {level}</span>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${(inLevel / XP_PER_LEVEL) * 100}%` }} />
          </div>
          <span className="best">BEST {save.best}</span>
        </div>

        <div className="vehicles">
          {VEHICLES.map((v) => {
            const locked = level < v.unlockLevel
            return (
              <button
                key={v.id}
                className={`vehicle ${selected === v.id && !locked ? 'active' : ''}`}
                disabled={locked}
                onClick={() => onSelect(v.id)}
                style={{ ['--c' as string]: v.css }}
              >
                <span className="swatch" />
                <strong>{v.name}</strong>
                <small>{locked ? `🔒 Unlocks at LV ${v.unlockLevel}` : v.blurb}</small>
              </button>
            )
          })}
        </div>

        <button className="cta" onClick={onStart}>
          START DELIVERY
        </button>

        <p className="controls">
          ← → or A D: change lane · SPACE: boost · Touch: swipe or use buttons · Enter: start
        </p>
      </div>
    </div>
  )
}
