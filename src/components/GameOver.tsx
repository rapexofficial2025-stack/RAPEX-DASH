import type { RunResult } from '../game/Game'

interface Props {
  result: RunResult
  best: number
  unlocked: string[]
  onRetry: () => void
  onMenu: () => void
}

export default function GameOver({ result, best, unlocked, onRetry, onMenu }: Props) {
  const isBest = result.score >= best && result.score > 0

  return (
    <div className="overlay">
      <div className="panel">
        <p className="kicker">SHIFT OVER</p>
        <h1 className="title">
          {result.score} <span>PTS</span>
        </h1>
        {isBest && <p className="new-best">★ NEW BEST SCORE ★</p>}

        <ul className="results">
          <li>
            <small>Deliveries</small>
            <strong>{result.deliveries}</strong>
          </li>
          <li>
            <small>Earned</small>
            <strong>₱{result.earnings}</strong>
          </li>
          <li>
            <small>Distance</small>
            <strong>{result.distance} m</strong>
          </li>
          <li>
            <small>XP gained</small>
            <strong>+{result.xp}</strong>
          </li>
        </ul>

        {unlocked.length > 0 && (
          <p className="unlock">🔓 Unlocked: {unlocked.join(', ')}</p>
        )}

        <button className="cta" onClick={onRetry}>
          RIDE AGAIN
        </button>
        <button className="ghost" onClick={onMenu}>
          Change vehicle
        </button>
      </div>
    </div>
  )
}
