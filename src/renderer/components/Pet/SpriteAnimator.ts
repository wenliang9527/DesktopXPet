import type { AnimationConfig, SpriteFrame } from '@shared/types'

/**
 * 精灵图动画引擎 — 纯逻辑类，不绑定 DOM
 * 关键优化：
 * - delta clamp 防止标签页不可见时 raf 停止导致的动画跳帧
 * - frameProgress 提供帧间进度 (0-1)，用于亚像素平滑
 * - needsRedraw 脏标记，避免未变帧时重复渲染
 */
export class SpriteAnimator {
  private image: HTMLImageElement
  private frameWidth: number
  private frameHeight: number
  private currentFrame: number = 0
  private frameCount: number
  private fps: number
  private loop: boolean
  private lastTick: number = 0
  private playing: boolean = true
  private _needsRedraw: boolean = true
  private _frameProgress: number = 0
  public onFinish?: () => void

  constructor(image: HTMLImageElement, config: AnimationConfig) {
    this.image = image
    this.frameWidth = config.frameSize?.width ?? 64
    this.frameHeight = config.frameSize?.height ?? 64
    this.frameCount = config.frames
    this.fps = config.fps
    this.loop = config.loop
  }

  get isPlaying(): boolean {
    return this.playing
  }

  get currentImage(): HTMLImageElement {
    return this.image
  }

  /** 脏标记：自上次渲染以来帧是否发生了变化 */
  get needsRedraw(): boolean {
    return this._needsRedraw
  }

  /** 当前帧进度 (0-1)，可用于帧间插值 */
  get frameProgress(): number {
    return this._frameProgress
  }

  /**
   * 每帧调用，返回当前帧的裁剪坐标
   */
  tick(timestamp: number): SpriteFrame {
    if (!this.playing) {
      this._frameProgress = 1
      return {
        sx: this.currentFrame * this.frameWidth,
        sy: 0,
        sw: this.frameWidth,
        sh: this.frameHeight,
      }
    }

    if (this.lastTick === 0) {
      this.lastTick = timestamp
      this._needsRedraw = true
    }

    const interval = 1000 / this.fps
    const delta = timestamp - this.lastTick
    // 关键：限制最大 delta 为 200ms，防止标签页隐藏后回来时跳帧
    const clampedDelta = Math.min(delta, 200)

    // 更新帧间进度（用于亚像素平滑渲染）
    this._frameProgress = Math.min(clampedDelta / interval, 1)

    if (clampedDelta >= interval) {
      this.lastTick = timestamp - (clampedDelta % interval)
      this.currentFrame++
      this._needsRedraw = true
      this._frameProgress = 0

      if (this.currentFrame >= this.frameCount) {
        if (this.loop) {
          this.currentFrame = 0
        } else {
          this.currentFrame = this.frameCount - 1
          this.playing = false
          this._frameProgress = 1
          this.onFinish?.()
        }
      }
    }

    return {
      sx: this.currentFrame * this.frameWidth,
      sy: 0,
      sw: this.frameWidth,
      sh: this.frameHeight,
    }
  }

  /**
   * 标记已渲染，清除脏标记
   */
  markRendered(): void {
    this._needsRedraw = false
  }

  /**
   * 重置动画到第一帧
   */
  reset(): void {
    this.currentFrame = 0
    this.lastTick = 0
    this.playing = true
    this._needsRedraw = true
    this._frameProgress = 0
  }
}
