import type { RefObject } from 'react'
import type { HudState } from '../game/Game'

interface Props {
  visible: boolean
  hud: HudState
  banner: string | null
  miniRef: RefObject<HTMLCanvasElement>
  onLane: (dir: -1 | 1) => void
  onBoost: (on: boolean) => void
}

export default function Hud({ visible, hud, banner, miniRef, onLane, onBoost }: Props) {
  return (
    <div className="hud" style={{ display: visible ? 'block' : 'none' }}>
      <div className="hud-top">
        <div className="hud-box">
          <small>SCORE</small>
          <strong>{hud.score}</strong>
        </div>
        <div className="hud-box mission">
          <small>MISSION {hud.mission} · PICKUP</small>
          <strong>
            {hud.packages} / {hud.target} 📦
          </strong>
        </div>
        <div className="hud-box">
          <small>EARNED</small>
          <strong>₱{hud.earnings}</strong>
        </div>
      </div>

      <div className="hud-left">
        <div className="hud-box gps">
          <small>TACTICAL GPS</small>
          <canvas ref={miniRef} width={96} height={160} />
        </div>
      </div>

      <div className="hud-right">
        <div className="lives">
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < hud.lives ? '' : 'lost'}>
              ♥
            </span>
          ))}
        </div>
        <div className="speed">
          {hud.speed}
          <small> km/h</small>
        </div>
        <div className="boost">
          <small>BOOST</small>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${hud.boost}%` }} />
          </div>
        </div>
      </div>

      {banner && <div className="banner">{banner}</div>}

      <div className="touch">
        <button onPointerDown={() => onLane(-1)}>◀</button>
        <button
          className="boost-btn"
          onPointerDown={() => onBoost(true)}
          onPointerUp={() => onBoost(false)}
          onPointerLeave={() => onBoost(false)}
        >
          BOOST
        </button>
        <button onPointerDown={() => onLane(1)}>▶</button>
      </div>
    </div>
  )
}
