import { useEffect, useRef, useState } from 'react'
import type { SkinManifest } from '@shared/types'

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

    const frameWidth = animConfig.frameSize?.width || manifest.frameSize.width
    const frameHeight = animConfig.frameSize?.height || manifest.frameSize.height
    const totalFrames = animConfig.frames
    const fps = animConfig.fps || 8
    const interval = 1000 / fps

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
        // 绘制当前帧(从精灵图中截取)
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
