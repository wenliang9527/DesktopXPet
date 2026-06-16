import type { AnimationConfig, SpriteFrame } from '@shared/types'

/**
 * 精灵图动画引擎 — 纯逻辑类，不绑定 DOM
 * 关键优化：delta clamp 防止标签页不可见时 raf 停止导致的动画跳帧
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

  /**
   * 每帧调用，返回当前帧的裁剪坐标
   */
  tick(timestamp: number): SpriteFrame {
    if (!this.playing) {
      return {
        sx: this.currentFrame * this.frameWidth,
        sy: 0,
        sw: this.frameWidth,
        sh: this.frameHeight
      }
    }

    if (this.lastTick === 0) {
      this.lastTick = timestamp
    }

    const interval = 1000 / this.fps
    const delta = timestamp - this.lastTick
    // 关键：限制最大 delta 为 200ms，防止标签页隐藏后回来时跳帧
    const clampedDelta = Math.min(delta, 200)

    if (clampedDelta >= interval) {
      this.lastTick = timestamp - (clampedDelta % interval)
      this.currentFrame++

      if (this.currentFrame >= this.frameCount) {
        if (this.loop) {
          this.currentFrame = 0
        } else {
          this.currentFrame = this.frameCount - 1
          this.playing = false
          this.onFinish?.()
        }
      }
    }

    return {
      sx: this.currentFrame * this.frameWidth,
      sy: 0,
      sw: this.frameWidth,
      sh: this.frameHeight
    }
  }

  /**
   * 重置动画到第一帧
   */
  reset(): void {
    this.currentFrame = 0
    this.lastTick = 0
    this.playing = true
  }
}
