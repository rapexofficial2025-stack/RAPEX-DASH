import { useEffect, useRef, useState } from 'react'
import { Game, type HudState, type RunResult } from './game/Game'
import { VEHICLES } from './game/vehicles'
import { levelFor, loadSave, writeSave, type SaveData } from './game/storage'
import Menu from './components/Menu'
import Hud from './components/Hud'
import GameOver from './components/GameOver'

type Screen = 'menu' | 'playing' | 'over'

const EMPTY_HUD: HudState = {
  score: 0,
  speed: 0,
  boost: 100,
  lives: 3,
  packages: 0,
  target: 3,
  mission: 1,
  earnings: 0,
  deliveries: 0,
}

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)

  const [save, setSave] = useState<SaveData>(loadSave)
  const saveRef = useRef(save)
  const [screen, setScreen] = useState<Screen>('menu')
  const [hud, setHud] = useState<HudState>(EMPTY_HUD)
  const [result, setResult] = useState<RunResult | null>(null)
  const [unlocked, setUnlocked] = useState<string[]>([])
  const [banner, setBanner] = useState<string | null>(null)

  const level = levelFor(save.totalXp)
  const vehicle =
    VEHICLES.find((v) => v.id === save.vehicle && level >= v.unlockLevel) ?? VEHICLES[0]

  const commit = (next: SaveData) => {
    saveRef.current = next
    setSave(next)
    writeSave(next)
  }

  // Create the 3D game once, and clean it up when the page closes.
  useEffect(() => {
    if (!stageRef.current) return
    const game = new Game(
      stageRef.current,
      miniRef.current,
      {
        onHud: setHud,
        onEvent: setBanner,
        onOver: (r) => {
          const prev = saveRef.current
          const before = levelFor(prev.totalXp)
          const after = levelFor(prev.totalXp + r.xp)
          setUnlocked(
            VEHICLES.filter((v) => v.unlockLevel > before && v.unlockLevel <= after).map(
              (v) => v.name,
            ),
          )
          commit({
            ...prev,
            best: Math.max(prev.best, r.score),
            totalXp: prev.totalXp + r.xp,
            earnings: prev.earnings + r.earnings,
          })
          setResult(r)
          setScreen('over')
        },
      },
      vehicle,
    )
    gameRef.current = game
    return () => {
      game.dispose()
      gameRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    gameRef.current?.setVehicle(vehicle)
  }, [vehicle])

  // Banner messages disappear after a moment.
  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 1400)
    return () => clearTimeout(t)
  }, [banner])

  const start = () => {
    setBanner(null)
    setHud(EMPTY_HUD)
    setScreen('playing')
    gameRef.current?.start()
  }

  // Press Enter to start or restart.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && screen !== 'playing') start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="shell">
      <div className="stage" ref={stageRef} />

      <Hud
        visible={screen === 'playing'}
        hud={hud}
        banner={banner}
        miniRef={miniRef}
        onLane={(d) => gameRef.current?.moveLane(d)}
        onBoost={(on) => gameRef.current?.setBoost(on)}
      />

      {screen === 'menu' && (
        <Menu
          save={save}
          level={level}
          selected={vehicle.id}
          onSelect={(id) => commit({ ...save, vehicle: id })}
          onStart={start}
        />
      )}

      {screen === 'over' && result && (
        <GameOver
          result={result}
          best={save.best}
          unlocked={unlocked}
          onRetry={start}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  )
}
