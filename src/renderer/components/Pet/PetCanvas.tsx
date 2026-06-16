import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useClickThrough } from '../../hooks/useClickThrough'
import { useDraggable } from '../../hooks/useDraggable'
import { SpriteAnimator } from './SpriteAnimator'
import type { PetState, SkinManifest } from '@shared/types'
import { PET_RENDER_SIZE } from '@shared/constants'

// 状态映射：waking 使用 idle 图片（因为没有单独的 waking 精灵图）
const STATE_IMAGE_MAP: Record<string, string> = {
  idle: 'idle',
  working: 'working',
  happy: 'happy',
  sleeping: 'sleeping',
  error: 'error',
  waking: 'idle'
}

interface PetCanvasProps {
  skinDir: string
  manifest: SkinManifest | null
}

export default function PetCanvas({ skinDir, manifest }: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animatorRef = useRef<SpriteAnimator | null>(null)
  const rafIdRef = useRef<number>(0)
  const visibleRef = useRef(true)
  const imagesRef = useRef<Record<string, HTMLImageElement>>({})
  const currentStateRef = useRef<PetState>('idle')

  const petState = useAppStore((s) => s.petState)
  const { handleMouseMove, handleMouseLeave } = useClickThrough(canvasRef)
  const { onMouseDown } = useDraggable()

  // 加载皮肤图片
  useEffect(() => {
    if (!manifest || !skinDir) return

    const states = ['idle', 'working', 'happy', 'sleeping', 'error']
    const promises = states.map(
      async (state) => {
        const imagePath = `${skinDir}/${state}.png`
        const dataUrl = await window.desktopXPet.readSkinImage(imagePath)
        if (!dataUrl) return
        return new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            imagesRef.current[state] = img
            resolve()
          }
          img.onerror = () => {
            console.error('Failed to load image:', imagePath)
            resolve()
          }
          img.src = dataUrl
        })
      }
    )

    Promise.all(promises).then(() => {
      // 图片加载完毕后，启动初始动画
      setupAnimator('idle')
    })
  }, [manifest, skinDir])

  // 状态切换时更新动画
  useEffect(() => {
    if (petState !== currentStateRef.current) {
      currentStateRef.current = petState
      const imageKey = STATE_IMAGE_MAP[petState] || 'idle'
      setupAnimator(imageKey)
    }
  }, [petState])

  const setupAnimator = useCallback(
    (stateKey: string) => {
      if (!manifest) return
      const img = imagesRef.current[stateKey]
      const animConfig = manifest.animations[stateKey]
      if (!img || !animConfig) return

      animatorRef.current = new SpriteAnimator(img, {
        frameSize: manifest.frameSize,
        ...animConfig
      })

      // waking 状态播放完毕后自动切换到 idle
      if (currentStateRef.current === 'waking') {
        animatorRef.current.onFinish = () => {
          useAppStore.getState().setPetState('idle')
        }
      }
    },
    [manifest]
  )

  // Canvas 渲染循环
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // DPI 修正
    const dpr = window.devicePixelRatio || 1
    const logicalSize = PET_RENDER_SIZE
    canvas.width = logicalSize * dpr
    canvas.height = logicalSize * dpr
    canvas.style.width = `${logicalSize}px`
    canvas.style.height = `${logicalSize}px`
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingEnabled = false // 像素风关键：关闭平滑

    // 窗口可见性监听
    const onVisibility = (): void => {
      visibleRef.current = !document.hidden
      if (visibleRef.current && !rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const render = (time: number): void => {
      if (!visibleRef.current) {
        rafIdRef.current = 0
        return
      }

      const animator = animatorRef.current
      if (animator) {
        const frame = animator.tick(time)
        ctx.clearRect(0, 0, logicalSize, logicalSize)
        ctx.drawImage(
          animator.currentImage,
          frame.sx,
          frame.sy,
          frame.sw,
          frame.sh,
          0,
          0,
          logicalSize,
          logicalSize
        )
      }

      rafIdRef.current = requestAnimationFrame(render)
    }

    rafIdRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafIdRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    window.desktopXPet.showContextMenu()
  }, [])

  // 双击打开仪表盘
  const handleDoubleClick = useCallback(() => {
    window.desktopXPet.openDashboard()
  }, [])

  // 点击互动：触发 happy 动画
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 只在角色不透明区域响应
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pixel = ctx.getImageData(x, y, 1, 1).data
    if (pixel[3] > 0) {
      // 点击在角色上 → 触发 happy 动画
      useAppStore.getState().setPetState('happy')
      // 动画结束后恢复
      setTimeout(() => {
        useAppStore.getState().setPetState('idle')
      }, 2000)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pet-canvas"
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    />
  )
}
