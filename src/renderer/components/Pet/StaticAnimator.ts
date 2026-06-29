import type { StaticAnimationConfig, StaticEffect, SpriteFrame } from '@shared/types'
import { PET_RENDER_SIZE } from '@shared/constants'

/**
 * 静态立绘动画引擎 — 对单张图片施加时间驱动的 Canvas 变换（浮动、呼吸、摇摆、弹跳）
 * 接口与 SpriteAnimator 保持一致，PetCanvas 可无缝切换
 */

/** 各效果的默认强度 */
const DEFAULT_INTENSITY: Record<string, number> = {
  float: 5,
  breathe: 0.015,
  sway: 0.04, // radians (~2.3°)
  bounce: 8,
}

/** 各效果的基础频率 (rad/ms) */
const BASE_FREQ: Record<string, number> = {
  float: 0.003,
  breathe: 0.004,
  sway: 0.002,
  bounce: 0.005,
}

/** 变换结果，供 PetCanvas 在 ctx 上 apply */
export interface AnimationTransform {
  translateX: number
  translateY: number
  scaleX: number
  scaleY: number
  rotation: number // radians
}

export class StaticAnimator {
  private image: HTMLImageElement
  private effects: StaticEffect[]
  private duration: number | undefined
  private startTime: number = 0
  private _finished: boolean = false
  public onFinish?: () => void

  constructor(image: HTMLImageElement, config: StaticAnimationConfig) {
    this.image = image
    this.effects = config.effects
    this.duration = config.duration
  }

  get isPlaying(): boolean {
    return !this._finished
  }

  get currentImage(): HTMLImageElement {
    return this.image
  }

  get frameProgress(): number {
    return 1
  }

  /**
   * 每帧调用 — 返回全图帧坐标（静态模式不需要裁剪精灵图）
   */
  tick(timestamp: number): SpriteFrame {
    if (this.startTime === 0) {
      this.startTime = timestamp
    }

    // 检查 duration（用于 happy 等非循环动画）
    if (this.duration != null && !this._finished) {
      const elapsed = (timestamp - this.startTime) / 1000
      if (elapsed >= this.duration) {
        this._finished = true
        this.onFinish?.()
      }
    }

    return {
      sx: 0,
      sy: 0,
      sw: PET_RENDER_SIZE,
      sh: PET_RENDER_SIZE,
    }
  }

  /**
   * 根据当前时间计算所有叠加的动画变换
   */
  computeTransforms(timestamp: number): AnimationTransform {
    const t = timestamp - this.startTime

    let translateX = 0
    let translateY = 0
    let scaleX = 1
    let scaleY = 1
    let rotation = 0

    for (const effect of this.effects) {
      const speed = effect.speed ?? 1
      const intensity = effect.intensity ?? DEFAULT_INTENSITY[effect.type] ?? 1
      const freq = BASE_FREQ[effect.type] ?? 0.003

      switch (effect.type) {
        case 'float':
          // 柔和的上下浮动
          translateY += Math.sin(t * speed * freq) * intensity
          break

        case 'breathe':
          // 呼吸感：水平微缩 + 垂直微扩（反相），模拟胸腔起伏
          {
            const phase = Math.sin(t * speed * freq)
            scaleX += -phase * intensity
            scaleY += phase * intensity
          }
          break

        case 'sway':
          // 左右摇摆（绕中心旋转）
          rotation += Math.sin(t * speed * freq) * intensity
          break

        case 'bounce':
          // 弹跳（只向上，用 abs(sin) 模拟抛物线）
          translateY += -Math.abs(Math.sin(t * speed * freq)) * intensity
          break
      }
    }

    return { translateX, translateY, scaleX, scaleY, rotation }
  }

  /**
   * 重置动画（状态切换时调用）
   */
  reset(): void {
    this.startTime = 0
    this._finished = false
  }
}
