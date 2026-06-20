import type { PetState } from '@shared/types'

// ============================================================
// 粒子系统 v2 — HSL 颜色变换 + 拖尾 + 渐变填充 + 丰富形状
// ============================================================

/** HSL 颜色，支持动态色相偏移 */
export interface HSLColor {
  h: number // 色相 0-360
  s: number // 饱和度 0-100
  l: number // 亮度 0-100
}

/** 粒子形状 */
export type ParticleShape =
  | 'circle' // 渐变圆
  | 'star5' // 5 角星
  | 'star6' // 6 角星
  | 'heart' // 爱心
  | 'diamond' // 菱形
  | 'petal' // 花瓣
  | 'ring' // 光环
  | 'text' // 文字 (z / ! 等)
  | 'sparkle' // 十字闪光

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  baseSize: number
  alpha: number
  /** HSL 颜色（动态） */
  color: HSLColor
  /** 色相偏移速度 (度/秒) */
  hueShiftSpeed: number
  shape: ParticleShape
  text?: string
  rotation: number
  rotationSpeed: number
  gravity: number
  /** 拖尾：最近 N 帧位置 */
  trail: { x: number; y: number; alpha: number }[]
  trailLength: number
  /** 尺寸脉冲相位 */
  pulsePhase: number
  pulseSpeed: number
  /** 阻力系数 (0=无阻力) */
  drag: number
}

/** 发射配置 */
interface EmitConfig {
  centerX: number
  centerY: number
  radius: number
  speedMin: number
  speedMax: number
  angleMin: number
  angleMax: number
  sizeMin: number
  sizeMax: number
  /** HSL 颜色池 */
  colors: HSLColor[]
  /** 色相偏移速度范围 (度/秒) */
  hueShiftMin: number
  hueShiftMax: number
  lifeMin: number
  lifeMax: number
  probability: number
  maxCount: number
  shapes: ParticleShape[]
  text?: string
  gravity?: number
  trailLength?: number
  drag?: number
}

// ============================================================
// 工具函数
// ============================================================

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function hslStr(c: HSLColor, alpha: number): string {
  const h = ((c.h % 360) + 360) % 360
  const l = Math.max(0, Math.min(100, c.l))
  const s = Math.max(0, Math.min(100, c.s))
  return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${alpha})`
}

// ============================================================
// 各状态粒子配置 — HSL 颜色 + 丰富形状
// ============================================================

const STATE_CONFIGS: Partial<Record<PetState, EmitConfig>> = {
  idle: {
    centerX: 0.5,
    centerY: 0.35,
    radius: 35,
    speedMin: 0.12,
    speedMax: 0.35,
    angleMin: -Math.PI,
    angleMax: 0,
    sizeMin: 2.5,
    sizeMax: 5,
    // 金色暖光 → 缓慢色相偏移产生虹彩效果
    colors: [
      { h: 45, s: 100, l: 75 }, // 金色
      { h: 50, s: 90, l: 85 }, // 浅金
      { h: 38, s: 100, l: 70 }, // 琥珀
      { h: 55, s: 95, l: 80 }, // 暖黄
    ],
    hueShiftMin: 5,
    hueShiftMax: 20,
    lifeMin: 1400,
    lifeMax: 2800,
    probability: 0.05,
    maxCount: 8,
    shapes: ['star5', 'sparkle', 'circle'],
    gravity: -0.004,
    trailLength: 3,
    drag: 0.001,
  },

  working: {
    centerX: 0.5,
    centerY: 0.2,
    radius: 28,
    speedMin: 0.25,
    speedMax: 0.7,
    angleMin: -Math.PI * 0.85,
    angleMax: -Math.PI * 0.15,
    sizeMin: 2.5,
    sizeMax: 4.5,
    // 冷色调蓝绿 → 偏移向紫色
    colors: [
      { h: 200, s: 85, l: 70 }, // 天蓝
      { h: 185, s: 80, l: 75 }, // 青色
      { h: 220, s: 90, l: 72 }, // 靛蓝
      { h: 270, s: 70, l: 75 }, // 薰衣草
    ],
    hueShiftMin: 10,
    hueShiftMax: 40,
    lifeMin: 900,
    lifeMax: 1800,
    probability: 0.07,
    maxCount: 10,
    shapes: ['circle', 'diamond', 'ring'],
    gravity: 0.015,
    trailLength: 4,
    drag: 0.002,
  },

  happy: {
    centerX: 0.5,
    centerY: 0.4,
    radius: 50,
    speedMin: 0.6,
    speedMax: 1.8,
    angleMin: -Math.PI,
    angleMax: 0,
    sizeMin: 3,
    sizeMax: 8,
    // 彩虹色全光谱 → 快速色相偏移
    colors: [
      { h: 0, s: 100, l: 70 }, // 红
      { h: 30, s: 100, l: 65 }, // 橙
      { h: 55, s: 100, l: 65 }, // 黄
      { h: 120, s: 80, l: 65 }, // 绿
      { h: 200, s: 90, l: 70 }, // 蓝
      { h: 280, s: 85, l: 72 }, // 紫
      { h: 320, s: 90, l: 70 }, // 粉
    ],
    hueShiftMin: 30,
    hueShiftMax: 80,
    lifeMin: 1200,
    lifeMax: 2500,
    probability: 0.18,
    maxCount: 24,
    shapes: ['star5', 'star6', 'heart', 'sparkle', 'petal', 'circle'],
    gravity: 0.008,
    trailLength: 5,
    drag: 0.001,
  },

  sleeping: {
    centerX: 0.7,
    centerY: 0.25,
    radius: 15,
    speedMin: 0.15,
    speedMax: 0.4,
    angleMin: -Math.PI * 0.7,
    angleMax: -Math.PI * 0.3,
    sizeMin: 9,
    sizeMax: 15,
    // 低饱和灰蓝 → 微幅色相漂移
    colors: [
      { h: 220, s: 30, l: 75 },
      { h: 240, s: 25, l: 80 },
      { h: 200, s: 20, l: 78 },
    ],
    hueShiftMin: 2,
    hueShiftMax: 8,
    lifeMin: 2000,
    lifeMax: 3500,
    probability: 0.025,
    maxCount: 4,
    shapes: ['text'],
    text: 'z',
    gravity: -0.006,
    trailLength: 0,
    drag: 0.0005,
  },

  error: {
    centerX: 0.5,
    centerY: 0.3,
    radius: 45,
    speedMin: 0.3,
    speedMax: 0.9,
    angleMin: -Math.PI,
    angleMax: 0,
    sizeMin: 3,
    sizeMax: 6,
    // 红色系 → 偏移向橙/紫产生不安感
    colors: [
      { h: 0, s: 95, l: 60 }, // 正红
      { h: 15, s: 100, l: 62 }, // 朱红
      { h: 340, s: 90, l: 65 }, // 玫红
      { h: 30, s: 100, l: 60 }, // 橙红
    ],
    hueShiftMin: 15,
    hueShiftMax: 50,
    lifeMin: 800,
    lifeMax: 1800,
    probability: 0.1,
    maxCount: 12,
    shapes: ['circle', 'diamond', 'ring', 'sparkle'],
    gravity: 0.012,
    trailLength: 4,
    drag: 0.003,
  },
}

// ============================================================
// ParticleSystem v2
// ============================================================

export class ParticleSystem {
  private particles: Particle[] = []
  private currentState: PetState = 'idle'
  private canvasWidth = 128
  private canvasHeight = 128
  private enabled = true
  /** 全局色相偏移（叠加到所有粒子上，随时间累积） */
  private globalHueOffset = 0
  /** 全局色相偏移速度 (度/秒) */
  private globalHueSpeed = 8

  constructor(width: number, height: number) {
    this.canvasWidth = width
    this.canvasHeight = height
  }

  setSize(w: number, h: number): void {
    this.canvasWidth = w
    this.canvasHeight = h
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.particles = []
  }

  setState(state: PetState): void {
    if (state !== this.currentState) {
      this.currentState = state
      // 切换状态时改变全局色相偏移速度
      switch (state) {
        case 'happy':
          this.globalHueSpeed = 15
          break
        case 'error':
          this.globalHueSpeed = 25
          break
        case 'working':
          this.globalHueSpeed = 10
          break
        case 'sleeping':
          this.globalHueSpeed = 3
          break
        default:
          this.globalHueSpeed = 8
      }
    }
  }

  // ----------------------------------------------------------
  // 更新
  // ----------------------------------------------------------

  update(deltaMs: number): void {
    if (!this.enabled) return

    // 全局色相偏移累积
    this.globalHueOffset += this.globalHueSpeed * deltaMs * 0.001

    const config = STATE_CONFIGS[this.currentState]
    if (config) this.emit(config)

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= deltaMs

      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }

      // 物理
      p.vy += p.gravity * deltaMs
      if (p.drag > 0) {
        const dragFactor = Math.max(0, 1 - p.drag * deltaMs * 0.06)
        p.vx *= dragFactor
        p.vy *= dragFactor
      }
      p.x += p.vx * deltaMs * 0.06
      p.y += p.vy * deltaMs * 0.06
      p.rotation += p.rotationSpeed * deltaMs * 0.001

      // 个体色相偏移
      p.color.h += p.hueShiftSpeed * deltaMs * 0.001

      // 尺寸脉冲
      p.pulsePhase += p.pulseSpeed * deltaMs * 0.001
      p.size = p.baseSize * (1 + Math.sin(p.pulsePhase) * 0.2)

      // 拖尾
      if (p.trailLength > 0) {
        p.trail.unshift({ x: p.x, y: p.y, alpha: p.alpha })
        if (p.trail.length > p.trailLength) p.trail.pop()
      }

      // Alpha 曲线：快速淡入 → 保持 → 缓慢消散
      const ratio = p.life / p.maxLife
      if (ratio > 0.85) {
        p.alpha = (1 - ratio) / 0.15
      } else if (ratio < 0.25) {
        p.alpha = ratio / 0.25
        // 消散阶段尺寸缩小
        p.size *= 0.6 + 0.4 * (ratio / 0.25)
      } else {
        p.alpha = 1
      }
    }
  }

  // ----------------------------------------------------------
  // 发射
  // ----------------------------------------------------------

  private emit(cfg: EmitConfig): void {
    if (this.particles.length >= cfg.maxCount) return
    if (Math.random() > cfg.probability) return

    const angle = rand(cfg.angleMin, cfg.angleMax)
    const speed = rand(cfg.speedMin, cfg.speedMax)
    const life = rand(cfg.lifeMin, cfg.lifeMax)
    const baseSize = rand(cfg.sizeMin, cfg.sizeMax)
    const spawnAngle = Math.random() * Math.PI * 2
    const spawnR = Math.random() * cfg.radius
    const baseColor = pick(cfg.colors)

    this.particles.push({
      x: cfg.centerX * this.canvasWidth + Math.cos(spawnAngle) * spawnR,
      y: cfg.centerY * this.canvasHeight + Math.sin(spawnAngle) * spawnR,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: baseSize,
      baseSize,
      alpha: 0,
      color: { h: baseColor.h, s: baseColor.s, l: baseColor.l },
      hueShiftSpeed: rand(cfg.hueShiftMin, cfg.hueShiftMax),
      shape: pick(cfg.shapes),
      text: cfg.text,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: rand(-1.5, 1.5),
      gravity: cfg.gravity ?? 0,
      trail: [],
      trailLength: cfg.trailLength ?? 0,
      drag: cfg.drag ?? 0,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: rand(2, 5),
    })
  }

  // ----------------------------------------------------------
  // 渲染
  // ----------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled || this.particles.length === 0) return

    ctx.save()

    for (const p of this.particles) {
      // 叠加全局色相偏移
      const drawColor: HSLColor = {
        h: p.color.h + this.globalHueOffset,
        s: p.color.s,
        l: p.color.l,
      }

      // 拖尾
      if (p.trail.length > 1) {
        this.drawTrail(ctx, p, drawColor)
      }

      // 主体
      ctx.globalAlpha = p.alpha * 0.9
      this.drawShape(ctx, p, drawColor)
    }

    ctx.restore()
  }

  // --- 拖尾渲染 ---

  private drawTrail(ctx: CanvasRenderingContext2D, p: Particle, color: HSLColor): void {
    const len = p.trail.length
    for (let i = 0; i < len; i++) {
      const t = p.trail[i]
      const progress = 1 - i / len // 1=最近 → 0=最远
      const trailAlpha = progress * progress * p.alpha * 0.35
      const trailSize = p.size * progress * 0.6

      if (trailAlpha < 0.02 || trailSize < 0.3) continue

      ctx.globalAlpha = trailAlpha
      ctx.beginPath()
      ctx.arc(t.x, t.y, trailSize, 0, Math.PI * 2)
      ctx.fillStyle = hslStr(color, 1)
      ctx.fill()
    }
  }

  // --- 形状分发 ---

  private drawShape(ctx: CanvasRenderingContext2D, p: Particle, color: HSLColor): void {
    switch (p.shape) {
      case 'circle':
        this.drawGradientCircle(ctx, p, color)
        break
      case 'star5':
        this.drawStar(ctx, p, color, 5)
        break
      case 'star6':
        this.drawStar(ctx, p, color, 6)
        break
      case 'heart':
        this.drawHeart(ctx, p, color)
        break
      case 'diamond':
        this.drawDiamond(ctx, p, color)
        break
      case 'petal':
        this.drawPetal(ctx, p, color)
        break
      case 'ring':
        this.drawRing(ctx, p, color)
        break
      case 'sparkle':
        this.drawSparkle(ctx, p, color)
        break
      case 'text':
        this.drawText(ctx, p, color)
        break
    }
  }

  // --- 渐变圆（径向渐变替代 shadowBlur） ---

  private drawGradientCircle(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor): void {
    const r = p.size
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.8)
    grad.addColorStop(0, hslStr({ h: c.h, s: c.s, l: Math.min(c.l + 20, 98) }, 0.95))
    grad.addColorStop(0.4, hslStr(c, 0.7))
    grad.addColorStop(1, hslStr(c, 0))
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 1.8, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  }

  // --- N 角星（渐变填充，无 shadowBlur） ---

  private drawStar(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor, points: number): void {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    const outer = p.size
    const inner = p.size * 0.38

    ctx.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner
      const a = (i * Math.PI) / points - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()

    // 渐变填充（替代 shadowBlur 发光效果）
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, outer * 1.5)
    grad.addColorStop(0, hslStr({ h: c.h, s: c.s, l: Math.min(c.l + 25, 98) }, 1))
    grad.addColorStop(0.6, hslStr(c, 0.85))
    grad.addColorStop(1, hslStr({ h: c.h, s: c.s, l: Math.max(0, c.l - 10) }, 0))
    ctx.fillStyle = grad
    ctx.fill()

    ctx.restore()
  }

  // --- 爱心 ---

  private drawHeart(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor): void {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    const s = p.size * 0.12
    ctx.beginPath()
    ctx.moveTo(0, s * 3)
    ctx.bezierCurveTo(-s * 5, -s * 1, -s * 1, -s * 5, 0, -s * 2)
    ctx.bezierCurveTo(s * 1, -s * 5, s * 5, -s * 1, 0, s * 3)
    ctx.closePath()

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 6)
    grad.addColorStop(0, hslStr({ h: c.h, s: c.s, l: Math.min(c.l + 15, 95) }, 1))
    grad.addColorStop(1, hslStr(c, 0))
    ctx.fillStyle = grad
    ctx.fill()

    ctx.restore()
  }

  // --- 菱形 ---

  private drawDiamond(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor): void {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    const r = p.size
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.6, 0)
    ctx.lineTo(0, r)
    ctx.lineTo(-r * 0.6, 0)
    ctx.closePath()

    // 渐变填充替代 shadowBlur
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5)
    grad.addColorStop(0, hslStr({ h: c.h, s: c.s, l: Math.min(c.l + 15, 95) }, 0.95))
    grad.addColorStop(1, hslStr(c, 0))
    ctx.fillStyle = grad
    ctx.fill()

    ctx.restore()
  }

  // --- 花瓣 ---

  private drawPetal(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor): void {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    const r = p.size
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(r * 0.5, -r, r, -r * 0.5, 0, r)
    ctx.bezierCurveTo(-r, -r * 0.5, -r * 0.5, -r, 0, 0)
    ctx.closePath()

    ctx.fillStyle = hslStr({ h: c.h, s: Math.min(c.s + 10, 100), l: c.l }, 0.85)
    ctx.fill()

    ctx.restore()
  }

  // --- 光环 ---

  private drawRing(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor): void {
    const r = p.size
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = hslStr(c, 0.8)
    ctx.lineWidth = Math.max(1, p.size * 0.3)
    ctx.stroke()
  }

  // --- 十字闪光 ---

  private drawSparkle(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor): void {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    const len = p.size * 1.2
    const thick = Math.max(0.8, p.size * 0.25)

    ctx.fillStyle = hslStr({ h: c.h, s: c.s, l: Math.min(c.l + 25, 98) }, 1)

    // 竖线
    ctx.fillRect(-thick / 2, -len, thick, len * 2)
    // 横线
    ctx.fillRect(-len, -thick / 2, len * 2, thick)

    ctx.restore()
  }

  // --- 文字 ---

  private drawText(ctx: CanvasRenderingContext2D, p: Particle, c: HSLColor): void {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation * 0.25)
    const fontSize = p.size
    ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`
    ctx.fillStyle = hslStr(c, 0.9)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.text || '', 0, 0)
    ctx.restore()
  }

  // ----------------------------------------------------------
  // 公共接口
  // ----------------------------------------------------------

  get particleCount(): number {
    return this.particles.length
  }

  clear(): void {
    this.particles = []
  }

  /** 设置全局色相偏移速度 (用于外部控制颜色变换节奏) */
  setGlobalHueSpeed(degreesPerSecond: number): void {
    this.globalHueSpeed = degreesPerSecond
  }
}
