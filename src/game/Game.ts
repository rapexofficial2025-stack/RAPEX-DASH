import * as THREE from 'three'
import type { Vehicle } from './vehicles'

export type GameState = 'idle' | 'playing' | 'over'

export interface HudState {
  score: number
  speed: number
  boost: number
  lives: number
  packages: number
  target: number
  mission: number
  earnings: number
  deliveries: number
}

export interface RunResult {
  score: number
  deliveries: number
  earnings: number
  xp: number
  distance: number
}

export interface Callbacks {
  onHud: (hud: HudState) => void
  onOver: (result: RunResult) => void
  onEvent: (message: string) => void
}

interface Thing {
  obj: THREE.Object3D
  lane: number
  kind: 'car' | 'parcel'
}

const LANES = [-2.4, 0, 2.4]
const SPAWN_Z = -140
const DESPAWN_Z = 10
const TRAFFIC_SPEED = 6
const START_LIVES = 3

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private player = new THREE.Group()
  private playerMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.6 })
  private dashes: THREE.Mesh[] = []
  private buildings: THREE.Mesh[] = []
  private things: Thing[] = []
  private resizeObserver: ResizeObserver
  private minimapCtx: CanvasRenderingContext2D | null

  private carGeo = new THREE.BoxGeometry(1.5, 0.7, 2.8)
  private roofGeo = new THREE.BoxGeometry(1.2, 0.5, 1.4)
  private tailGeo = new THREE.BoxGeometry(1.3, 0.15, 0.05)
  private parcelGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9)
  private tailMat = new THREE.MeshBasicMaterial({ color: 0xff2020 })
  private roofMat = new THREE.MeshStandardMaterial({ color: 0x111122 })
  private parcelMat = new THREE.MeshStandardMaterial({
    color: 0xffc93c,
    emissive: 0xffa800,
    emissiveIntensity: 0.9,
  })
  private carMats = [0xff6a00, 0x9b30ff, 0xff2e2e, 0x2e6bff].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }),
  )

  private raf = 0
  private last = performance.now()
  private hudTimer = 0
  private spawnTimer = 0
  private shake = 0
  private touchStartX: number | null = null

  // Run state
  private state: GameState = 'idle'
  private vehicle: Vehicle
  private lane = 1
  private speed = 8
  private distance = 0
  private boost = 100
  private boostHeld = false
  private lives = START_LIVES
  private invuln = 0
  private collected = 0
  private packages = 0
  private mission = 0
  private deliveries = 0
  private earnings = 0
  private missionXp = 0

  constructor(
    private container: HTMLElement,
    minimap: HTMLCanvasElement | null,
    private cb: Callbacks,
    vehicle: Vehicle,
  ) {
    this.vehicle = vehicle
    this.minimapCtx = minimap ? minimap.getContext('2d') : null

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x1a0a33)
    this.scene.fog = new THREE.Fog(0x1a0a33, 30, 140)
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 300)

    this.buildWorld()
    this.buildPlayer()
    this.setVehicle(vehicle)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp)

    this.raf = requestAnimationFrame(this.tick)
  }

  // ---------- public controls ----------

  setVehicle(vehicle: Vehicle) {
    this.vehicle = vehicle
    this.playerMat.color.setHex(vehicle.color)
    this.playerMat.emissive.setHex(vehicle.color)
  }

  start() {
    this.things.forEach((t) => this.scene.remove(t.obj))
    this.things = []
    this.state = 'playing'
    this.lane = 1
    this.speed = this.vehicle.baseSpeed
    this.distance = 0
    this.boost = 100
    this.lives = START_LIVES
    this.invuln = 0
    this.collected = 0
    this.packages = 0
    this.mission = 0
    this.deliveries = 0
    this.earnings = 0
    this.missionXp = 0
    this.spawnTimer = 0.5
    this.emitHud()
  }

  moveLane(dir: -1 | 1) {
    if (this.state !== 'playing') return
    this.lane = Math.max(0, Math.min(2, this.lane + dir))
  }

  setBoost(on: boolean) {
    this.boostHeld = on
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => m.dispose())
      }
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ---------- scene building ----------

  private buildWorld() {
    this.scene.add(new THREE.AmbientLight(0x8877cc, 1.1))
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(3, 10, 5)
    this.scene.add(sun)

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 400),
      new THREE.MeshStandardMaterial({ color: 0x1b1b2b }),
    )
    road.rotation.x = -Math.PI / 2
    road.position.z = -180
    this.scene.add(road)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 400),
      new THREE.MeshStandardMaterial({ color: 0x0b0616 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, -0.05, -180)
    this.scene.add(ground)

    const edgeGeo = new THREE.BoxGeometry(0.15, 0.1, 400)
    ;[
      [-4, 0xff2e9a],
      [4, 0x00e5ff],
    ].forEach(([x, color]) => {
      const edge = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color }))
      edge.position.set(x, 0.05, -180)
      this.scene.add(edge)
    })

    const dashGeo = new THREE.BoxGeometry(0.15, 0.02, 3)
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffc93c })
    for (let i = 0; i < 20; i++) {
      ;[-1.2, 1.2].forEach((x) => {
        const d = new THREE.Mesh(dashGeo, dashMat)
        d.position.set(x, 0.03, 10 - i * 8)
        this.dashes.push(d)
        this.scene.add(d)
      })
    }

    const tones = [0x1a1440, 0x14203f, 0x2a1240, 0x101a36].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 }),
    )
    const unit = new THREE.BoxGeometry(1, 1, 1)
    for (let i = 0; i < 12; i++) {
      ;[-1, 1].forEach((side) => {
        const b = new THREE.Mesh(unit, tones[Math.floor(Math.random() * tones.length)])
        this.placeBuilding(b, side, 12 - i * 14)
        this.buildings.push(b)
        this.scene.add(b)
      })
    }
  }

  private placeBuilding(b: THREE.Mesh, side: number, z: number) {
    const w = 3 + Math.random() * 3
    const h = 6 + Math.random() * 26
    b.scale.set(w, h, 6)
    b.position.set(side * (6.5 + w / 2 + Math.random() * 2), h / 2, z)
  }

  private buildPlayer() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 1.7), this.playerMat)
    body.position.y = 0.55
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xbff8ff, emissive: 0x66eeff, emissiveIntensity: 0.5 }),
    )
    canopy.position.set(0, 0.95, -0.1)
    const wheelGeo = new THREE.BoxGeometry(0.3, 0.5, 0.5)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12 })
    ;[-0.7, 0.7].forEach((z) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat)
      w.position.set(0, 0.25, z)
      this.player.add(w)
    })
    this.player.add(body, canopy)
    this.scene.add(this.player)
  }

  private makeCar(): THREE.Object3D {
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      this.carGeo,
      this.carMats[Math.floor(Math.random() * this.carMats.length)],
    )
    body.position.y = 0.55
    const roof = new THREE.Mesh(this.roofGeo, this.roofMat)
    roof.position.set(0, 1.15, 0.1)
    const tail = new THREE.Mesh(this.tailGeo, this.tailMat)
    tail.position.set(0, 0.7, 1.42)
    g.add(body, roof, tail)
    return g
  }

  // ---------- input ----------

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLane(-1)
        break
      case 'ArrowRight':
      case 'KeyD':
        this.moveLane(1)
        break
      case 'Space':
      case 'ArrowUp':
      case 'ShiftLeft':
        this.boostHeld = true
        break
      default:
        return
    }
    if (this.state === 'playing') e.preventDefault()
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ShiftLeft') this.boostHeld = false
  }

  private onPointerDown = (e: PointerEvent) => {
    this.touchStartX = e.clientX
  }

  private onPointerUp = (e: PointerEvent) => {
    if (this.touchStartX === null) return
    const dx = e.clientX - this.touchStartX
    this.touchStartX = null
    if (Math.abs(dx) > 30) this.moveLane(dx > 0 ? 1 : -1)
  }

  // ---------- main loop ----------

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private tick = (t: number) => {
    this.raf = requestAnimationFrame(this.tick)
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016)
    this.last = t
    this.update(dt)
    this.renderer.render(this.scene, this.camera)
    this.drawMinimap()
  }

  private update(dt: number) {
    const playing = this.state === 'playing'
    const boosting = playing && this.boostHeld && this.boost > 0

    // Speed and boost
    let target = 8
    if (playing) {
      target = this.vehicle.baseSpeed + Math.min(this.distance / 400, 1) * 10
      if (boosting) target *= this.vehicle.boostMult
    }
    this.speed += (target - this.speed) * Math.min(1, dt * 3)
    this.boost = boosting ? Math.max(0, this.boost - 30 * dt) : Math.min(100, this.boost + 10 * dt)

    // Player lane movement + tilt
    const targetX = LANES[this.lane]
    const dx = targetX - this.player.position.x
    this.player.position.x += dx * Math.min(1, dt * this.vehicle.lateral)
    this.player.rotation.z = -dx * 0.12
    this.player.rotation.y = -dx * 0.08

    // Camera follow + shake
    this.shake = Math.max(0, this.shake - dt * 1.5)
    this.camera.position.set(
      this.player.position.x * 0.5 + (Math.random() - 0.5) * this.shake,
      3.4 + (boosting ? 0.3 : 0),
      6.5,
    )
    this.camera.lookAt(this.player.position.x * 0.3, 0.8, -10)

    // Scroll the world
    const move = this.speed * dt
    this.dashes.forEach((d) => {
      d.position.z += move
      if (d.position.z > DESPAWN_Z) d.position.z -= 160
    })
    this.buildings.forEach((b) => {
      b.position.z += move
      if (b.position.z > 12) this.placeBuilding(b, Math.sign(b.position.x), b.position.z - 168)
    })

    if (!playing) return

    this.distance += move
    this.invuln = Math.max(0, this.invuln - dt)
    this.player.visible = this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0

    // Spawning
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnRow()
      this.spawnTimer = (26 / this.speed) * (0.8 + Math.random() * 0.5)
    }

    // Move things + collisions
    for (let i = this.things.length - 1; i >= 0; i--) {
      const th = this.things[i]
      if (th.kind === 'car') th.obj.position.z += Math.max(2, this.speed - TRAFFIC_SPEED) * dt
      else {
        th.obj.position.z += move
        th.obj.rotation.y += dt * 2.5
        th.obj.position.y = 0.9 + Math.sin(this.distance * 0.3) * 0.15
      }

      const z = th.obj.position.z
      const near = Math.abs(th.obj.position.x - this.player.position.x)

      if (th.kind === 'car' && this.invuln <= 0 && near < 1.2 && Math.abs(z) < 2.2) {
        this.crash()
        if (this.state !== 'playing') return
      } else if (th.kind === 'parcel' && near < 1.3 && Math.abs(z) < 1.5) {
        this.pickup()
        this.scene.remove(th.obj)
        this.things.splice(i, 1)
        continue
      }

      if (z > DESPAWN_Z) {
        this.scene.remove(th.obj)
        this.things.splice(i, 1)
      }
    }

    this.hudTimer -= dt
    if (this.hudTimer <= 0) this.emitHud()
  }

  private spawnRow() {
    const carLanes = new Set<number>()
    const count = Math.random() < 0.4 ? 2 : 1
    while (carLanes.size < count) carLanes.add(Math.floor(Math.random() * 3))

    carLanes.forEach((lane) => {
      const obj = this.makeCar()
      obj.position.set(LANES[lane], 0, SPAWN_Z)
      this.scene.add(obj)
      this.things.push({ obj, lane, kind: 'car' })
    })

    if (Math.random() < 0.75) {
      const free = [0, 1, 2].filter((l) => !carLanes.has(l))
      const lane = free[Math.floor(Math.random() * free.length)]
      const obj = new THREE.Mesh(this.parcelGeo, this.parcelMat)
      obj.position.set(LANES[lane], 0.9, SPAWN_Z - 10)
      this.scene.add(obj)
      this.things.push({ obj, lane, kind: 'parcel' })
    }
  }

  private target() {
    return Math.min(3 + this.mission, 8)
  }

  private pickup() {
    this.collected++
    this.packages++
    if (this.packages >= this.target()) {
      const pay = 60 + this.target() * 15
      this.earnings += pay
      this.missionXp += 40 + this.target() * 10
      this.deliveries++
      this.mission++
      this.packages = 0
      this.cb.onEvent(`DELIVERED  +₱${pay}`)
    } else {
      this.cb.onEvent('PARCEL PICKED UP')
    }
    this.emitHud()
  }

  private crash() {
    this.lives--
    this.invuln = 1.8
    this.speed *= 0.5
    this.shake = 0.6
    this.cb.onEvent('CRASH!')
    if (this.lives <= 0) this.gameOver()
    else this.emitHud()
  }

  private score() {
    return Math.floor(this.distance / 5) + this.collected * 50 + this.deliveries * 200
  }

  private gameOver() {
    this.state = 'over'
    this.player.visible = true
    const score = this.score()
    this.emitHud()
    this.cb.onOver({
      score,
      deliveries: this.deliveries,
      earnings: this.earnings,
      xp: Math.floor(score / 20) + this.missionXp,
      distance: Math.floor(this.distance),
    })
  }

  private emitHud() {
    this.hudTimer = 0.1
    this.cb.onHud({
      score: this.score(),
      speed: Math.round(this.speed * 4),
      boost: Math.round(this.boost),
      lives: this.lives,
      packages: this.packages,
      target: this.target(),
      mission: this.mission + 1,
      earnings: this.earnings,
      deliveries: this.deliveries,
    })
  }

  // ---------- tactical GPS minimap ----------

  private drawMinimap() {
    const ctx = this.minimapCtx
    if (!ctx) return
    const { width: w, height: h } = ctx.canvas
    ctx.fillStyle = '#070912'
    ctx.fillRect(0, 0, w, h)

    const laneW = w / 3
    ctx.strokeStyle = '#1f2a55'
    ctx.lineWidth = 1
    for (let i = 1; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(i * laneW, 0)
      ctx.lineTo(i * laneW, h)
      ctx.stroke()
    }

    const playerY = h * 0.85
    const yFor = (z: number) => playerY + (z / -SPAWN_Z) * playerY
    const xFor = (x: number) => (x / 2.4) * laneW + w / 2

    this.things.forEach((th) => {
      const y = yFor(th.obj.position.z)
      const x = xFor(th.obj.position.x)
      if (th.kind === 'car') {
        ctx.fillStyle = '#ff4a4a'
        ctx.fillRect(x - 6, y - 8, 12, 16)
      } else {
        ctx.fillStyle = '#ffc93c'
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    ctx.fillStyle = '#00e5ff'
    ctx.beginPath()
    ctx.moveTo(xFor(this.player.position.x), playerY - 10)
    ctx.lineTo(xFor(this.player.position.x) - 7, playerY + 8)
    ctx.lineTo(xFor(this.player.position.x) + 7, playerY + 8)
    ctx.closePath()
    ctx.fill()
  }
}
