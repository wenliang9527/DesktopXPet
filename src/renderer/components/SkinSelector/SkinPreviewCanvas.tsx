import { useEffect, useRef, useState } from 'react'
import type { SkinManifest, SpritesheetAnimationConfig } from '@shared/types'
import { isStaticAnimationConfig } from '@shared/types'

interface SkinPreviewCanvasProps {
  skinPath: string
  manifest: SkinManifest | undefined
  size?: number
}

/**
 * 皮肤动画预览 — 用 canvas 绘制 idle 动画循环
 * 悬停在 SkinSelector 卡片上时显示
 */
export default function SkinPreviewCanvas({
  skinPath,
  manifest,
  size = 80,
}: SkinPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!manifest || !skinPath) return

    let cancelled = false
    const animConfig = manifest.animations?.idle
    if (!animConfig) {
      return
    }

    // 加载 idle 精灵图
    const spritePath = `${skinPath.replace(/\\/g, '/')}/idle.png`
    window.desktopXPet
      .readSkinImage(spritePath)
      .then((dataUrl) => {
        if (cancelled || !dataUrl) return
        const img = new Image()
        img.onload = () => {
          if (!cancelled) {
            imageRef.current = img
            setLoaded(true)
          }
        }
        img.src = dataUrl
      })
      .catch(() => {
        // 加载失败,静默忽略
      })

    return () => {
      cancelled = true
    }
  }, [skinPath, manifest])

  // 绘制动画循环
  useEffect(() => {
    if (!loaded || !imageRef.current || !manifest) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = imageRef.current
    const animConfig = manifest.animations?.idle
    if (!animConfig) return

    const isStatic = manifest.renderMode === 'static' || isStaticAnimationConfig(animConfig)
    const spriteConfig = isStatic ? null : (animConfig as SpritesheetAnimationConfig)

    const frameWidth = isStatic
      ? img.width
      : (spriteConfig!.frameSize?.width || manifest.frameSize.width)
    const frameHeight = isStatic
      ? img.height
      : (spriteConfig!.frameSize?.height || manifest.frameSize.height)
    const totalFrames = isStatic ? 1 : spriteConfig!.frames
    const fps = isStatic ? 0 : (spriteConfig!.fps || 8)
    const interval = fps > 0 ? 1000 / fps : 16

    let rafId = 0
    let lastTime = 0
    let currentFrame = 0

    // 设置 canvas 尺寸(按比例缩放到 size)
    const scale = size / Math.max(frameWidth, frameHeight)
    canvas.width = frameWidth * scale
    canvas.height = frameHeight * scale

    const render = (time: number): void => {
      if (time - lastTime >= interval) {
        lastTime = time
        // 清空 canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (isStatic) {
          // 静态模式：绘制完整图片 + 微妙呼吸缩放
          const breathe = 1 + Math.sin(time * 0.003) * 0.02
          const cx = canvas.width / 2
          const cy = canvas.height / 2
          ctx.save()
          ctx.translate(cx, cy)
          ctx.scale(breathe, breathe)
          ctx.translate(-cx, -cy)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          ctx.restore()
        } else {
          // 精灵图模式：从精灵图中截取当前帧
          ctx.drawImage(
            img,
            currentFrame * frameWidth,
            0,
            frameWidth,
            frameHeight,
            0,
            0,
            canvas.width,
            canvas.height
          )
          // 下一帧(循环)
          currentFrame = (currentFrame + 1) % totalFrames
        }
      }
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [loaded, manifest, size])

  if (!loaded) {
    return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>加载中...</div>
  }

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />
}
