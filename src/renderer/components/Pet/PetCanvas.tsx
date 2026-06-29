import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useClickThrough } from '../../hooks/useClickThrough'
import { useDraggable } from '../../hooks/useDraggable'
import { SpriteAnimator } from './SpriteAnimator'
import { StaticAnimator } from './StaticAnimator'
import { ParticleSystem } from './ParticleSystem'
import type { PetState, SkinManifest, SpritesheetAnimationConfig } from '@shared/types'
import { isStaticAnimationConfig } from '@shared/types'
import { PET_RENDER_SIZE } from '@shared/constants'

/** HD 皮肤判定阈值:源帧最大边 > 渲染尺寸 × 1.5 视为 HD,使用双线性插值 */
const HD_THRESHOLD = PET_RENDER_SIZE * 1.5

/** 基础状态(非互动动作),waking 为可选独立图,缺失时静默回退 idle */
const BASE_STATES = ['idle', 'working', 'happy', 'sleeping', 'error', 'waking']

/** 默认互动动作图(向后兼容:manifest 无 actions 时使用) */
const DEFAULT_ACTION_IMAGES = ['jump', 'eat', 'stroke']

// 状态映射:waking 使用独立 waking.png,缺失时由渲染层回退到 idle
const STATE_IMAGE_MAP: Record<string, string> = {
  idle: 'idle',
  working: 'working',
  happy: 'happy',
  sleeping: 'sleeping',
  error: 'error',
  waking: 'waking',
}

interface PetCanvasProps {
  skinDir: string
  manifest: SkinManifest | null
}

/** 皮肤切换过渡动画时长 (ms) */
const TRANSITION_FADE_OUT = 250
const TRANSITION_FADE_IN = 350

/** 互动触发方式(对应 manifest.actions 的 trigger) */
type InteractTrigger = 'click' | 'feed' | 'stroke'

/** 互动动作特效 */
interface InteractionEffect {
  type: 'jump' | 'wiggle' | 'eat'
  priority: number
  startTime: number
  duration: number
}

/** 触发方式 → 默认视觉特效 + 默认动作图(向后兼容:manifest 无 actions 时使用) */
const TRIGGER_DEFAULTS: Record<InteractTrigger, { effect: InteractionEffect['type']; image: string }> = {
  click: { effect: 'jump', image: 'jump' },
  feed: { effect: 'eat', image: 'eat' },
  stroke: { effect: 'wiggle', image: 'stroke' },
}

/** 默认互动优先级(manifest.actions 缺失或动作未声明 priority 时兜底) */
const DEFAULT_INTERACTION_PRIORITY: Record<InteractionEffect['type'], number> = {
  jump: 3,
  eat: 2,
  wiggle: 1,
}

function computeInteractionOffset(effect: InteractionEffect | null, time: number): { x: number; y: number; scale: number } {
  if (!effect) return { x: 0, y: 0, scale: 1 }
  const elapsed = time - effect.startTime
  if (elapsed < 0 || elapsed > effect.duration) return { x: 0, y: 0, scale: 1 }
  const t = elapsed / effect.duration

  if (effect.type === 'wiggle') {
    // 左右摇摆 3 次
    const x = Math.sin(t * Math.PI * 6) * 6 * (1 - t)
    return { x, y: 0, scale: 1 }
  }

  if (effect.type === 'jump') {
    // 向上跳跃 + 落地缓冲
    const jumpY = -Math.sin(t * Math.PI) * 18 * (1 - t * 0.3)
    return { x: 0, y: jumpY, scale: 1 }
  }

  // eat: 咀嚼缩放
  const chew = Math.sin(t * Math.PI * 8) * 0.06 * (1 - t)
  return { x: 0, y: 0, scale: 1 + chew }
}

export default function PetCanvas({ skinDir, manifest }: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animatorRef = useRef<SpriteAnimator | StaticAnimator | null>(null)
  // lazy init ParticleSystem，避免每次渲染都创建新实例
  const particleRef = useRef<ParticleSystem | null>(null)
  if (particleRef.current === null) {
    particleRef.current = new ParticleSystem(PET_RENDER_SIZE, PET_RENDER_SIZE)
  }
  const rafIdRef = useRef<number>(0)
  const visibleRef = useRef(true)
  const isWindowFocusedRef = useRef(true)
  // 上一帧实际渲染的时间戳，用于帧率控制
  const lastRenderTimeRef = useRef(0)
  // 预缩放的精灵图（offscreen canvas，已缩放到 render size）
  const scaledImagesRef = useRef<Record<string, HTMLCanvasElement>>({})
  const currentStateRef = useRef<PetState>('idle')
  // 缓存 DPR 用于像素检测
  const dprRef = useRef(window.devicePixelRatio || 1)
  // 当前皮肤的 HD 状态缓存（由独立的 manifest effect 同步，避免主渲染循环依赖 manifest）
  const hdRef = useRef(false)

  // 互动动作特效
  const interactionEffectRef = useRef<InteractionEffect | null>(null)
  // 摸头悬停计时器(鼠标停留 1.5 秒后触发 stroke 动作)
  const strokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 启动互动动作(带优先级锁,避免低优先级覆盖高优先级)
  // trigger: 触发方式,从 manifest.actions 查找匹配动作(取 priority 最高),找不到用默认
  // 返回匹配的动作图名(用于 setupAnimator);被优先级锁拒绝则返回 null
  const startInteraction = useCallback(
    (trigger: InteractTrigger, duration: number): { image: string } | null => {
      const defaults = TRIGGER_DEFAULTS[trigger]
      // 从 manifest.actions 查找匹配 trigger 的动作,取 priority 最高的
      const matched = manifest?.actions?.filter((a) => a.trigger === trigger) ?? []
      const action =
        matched.length > 0
          ? matched.reduce((max, a) => (a.priority > max.priority ? a : max))
          : null
      const effect = defaults.effect
      const image = action?.image ?? defaults.image
      const priority = action?.priority ?? DEFAULT_INTERACTION_PRIORITY[effect]
      const currentPriority = interactionEffectRef.current
        ? interactionEffectRef.current.priority
        : 0
      if (priority < currentPriority) return null
      interactionEffectRef.current = { type: effect, priority, startTime: performance.now(), duration }
      return { image }
    },
    [manifest]
  )

  // 基于 manifest.states 动态构建完整图片映射(基础 6 状态 + 养成状态)
  // manifest.states 不存在时,仅使用基础映射,行为与改造前一致
  const dynamicImageMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { ...STATE_IMAGE_MAP }
    const states = manifest?.states
    if (states && Array.isArray(states)) {
      for (const s of states) {
        if (s.name && s.image) {
          map[s.name] = s.image
        }
      }
    }
    return map
  }, [manifest])

  // 解析状态对应的图片键:
  // - waking.png 未加载时静默回退到 idle(可选皮肤不必提供 waking 图)
  // - 养成状态图未加载时也回退到 idle(向后兼容:旧皮肤无养成状态图)
  const resolveImageKey = useCallback((state: string): string => {
    const key = dynamicImageMap[state] || 'idle'
    // 对应图片未加载时统一回退 idle(waking 与养成状态共用此回退路径)
    if (!scaledImagesRef.current[key]) {
      return 'idle'
    }
    return key
  }, [dynamicImageMap])

  // 光晕和阴影 gradient 缓存（按 state 缓存，避免每帧重建）
  // 移入组件 ref，避免模块级缓存跨 context 失效
  const glowGradientCacheRef = useRef<Map<string, CanvasGradient>>(new Map())
  const shadowGradientCacheRef = useRef<Map<string, CanvasGradient>>(new Map())

  // --- 皮肤切换过渡状态 ---
  const transitionRef = useRef({
    alpha: 1, // 当前不透明度 (1=完全显示, 0=完全透明)
    phase: 'none' as 'none' | 'fade-out' | 'fade-in',
    phaseStart: 0, // 当前阶段开始时间
    pendingManifest: null as SkinManifest | null,
    pendingSkinDir: '' as string,
    // 上一帧时间戳
    lastFrame: 0,
  })

  const petState = useAppStore((s) => s.petState)
  const displayState = useAppStore((s) => s.displayState)
  const unlockedStates = useAppStore((s) => s.unlockedStates)
  const setInteractionMessage = useAppStore((s) => s.setInteractionMessage)
  useClickThrough(canvasRef)
  const { onMouseDown } = useDraggable()

  // 判断当前皮肤是否为 HD（源帧最大边 > HD_THRESHOLD）
  const isHDSkin = (m: SkinManifest | null): boolean => {
    if (!m?.frameSize) return false
    return Math.max(m.frameSize.width, m.frameSize.height) > HD_THRESHOLD
  }

  // 加载皮肤图片（并行读取 + 预缩放精灵图到 render size + 应用 displayScale）
  const loadSkinImages = useCallback((m: SkinManifest, dir: string): Promise<void> => {
    // 基础状态 + 互动动作图 + manifest.states 养成状态图(去重)
    // 无 actions 时用默认动作兜底;无 states 时仅加载基础+动作图
    const actionImages = m.actions?.map((a) => a.image) ?? DEFAULT_ACTION_IMAGES
    const stateImages = m.states?.map((s) => s.image) ?? []
    const states = Array.from(new Set([...BASE_STATES, ...actionImages, ...stateImages]))
    const renderSize = PET_RENDER_SIZE
    const hd = isHDSkin(m)
    const scale = m.displayScale ?? 1.0

    // 释放旧皮肤的 canvas
    scaledImagesRef.current = {}

    // 阶段 1：并行读取所有图片的 base64
    return Promise.all(
      states.map((state) => window.desktopXPet.readSkinImage(`${dir}/${state}.png`))
    )
      .then((dataUrls) => {
        // 阶段 2：并行解码 + 预缩放精灵图到 render size，并应用 displayScale
        return Promise.all(
          states.map((state, i) => {
            const dataUrl = dataUrls[i]
            if (!dataUrl) return Promise.resolve()
            return new Promise<void>((resolve) => {
              const img = new Image()
              img.onload = () => {
                const animConfig = m.animations[state]
                // 静态模式：每张图只有 1 帧；精灵图模式：从 config 读取帧数
                const frameCount =
                  m.renderMode === 'static'
                    ? 1
                    : (animConfig && 'frames' in animConfig
                        ? (animConfig as SpritesheetAnimationConfig).frames
                        : 1)
                const scaledWidth = renderSize * frameCount
                const scaledHeight = renderSize
                const offscreen = document.createElement('canvas')
                offscreen.width = scaledWidth
                offscreen.height = scaledHeight
                const ctx = offscreen.getContext('2d')
                if (ctx) {
                  // HD 皮肤使用双线性插值（平滑），像素皮肤使用最近邻（锐利）
                  ctx.imageSmoothingEnabled = hd
                  if (hd) {
                    ctx.imageSmoothingQuality = 'high'
                  }

                  // 源帧尺寸
                  const srcFrameW = img.width / frameCount
                  const srcFrameH = img.height

                  // 保持源帧宽高比，计算目标绘制尺寸
                  const srcAspect = srcFrameW / srcFrameH
                  let drawW: number, drawH: number
                  if (srcAspect >= 1) {
                    // 宽帧或方帧：以 renderSize 为宽度基准
                    drawW = renderSize * scale
                    drawH = drawW / srcAspect
                  } else {
                    // 高帧：以 renderSize 为高度基准
                    drawH = renderSize * scale
                    drawW = drawH * srcAspect
                  }

                  // 水平居中，底部对齐（人型宠物脚踩地面，不会"飘"在空中）
                  const offsetX = (renderSize - drawW) / 2
                  const offsetY = renderSize - drawH

                  // 逐帧绘制（统一路径，不再区分有无 displayScale）
                  for (let f = 0; f < frameCount; f++) {
                    ctx.save()
                    // 裁剪到当前帧区域，防止 displayScale > 1 时溢出到相邻帧
                    ctx.beginPath()
                    ctx.rect(f * renderSize, 0, renderSize, renderSize)
                    ctx.clip()

                    ctx.translate(f * renderSize + offsetX, offsetY)
                    ctx.drawImage(
                      img,
                      f * srcFrameW,
                      0,
                      srcFrameW,
                      srcFrameH, // 源：单帧
                      0,
                      0,
                      drawW,
                      drawH // 目标：保持宽高比，底部对齐
                    )
                    ctx.restore()
                  }
                }
                scaledImagesRef.current[state] = offscreen
                resolve()
              }
              img.onerror = () => {
                console.error('Failed to load image:', state)
                resolve()
              }
              img.src = dataUrl
            })
          })
        )
      })
      .then(() => {
        setupAnimator('idle', m)
      })
  }, [])

  // 设置动画器（必须在引用它的 useEffect 之前定义，避免 TDZ）
  const setupAnimator = useCallback(
    (stateKey: string, m?: SkinManifest) => {
      const currentManifest = m || manifest
      if (!currentManifest) return
      const scaledCanvas = scaledImagesRef.current[stateKey]
      const animConfig = currentManifest.animations[stateKey]
      if (!scaledCanvas || !animConfig) return

      const fakeImage = scaledCanvas as unknown as HTMLImageElement

      if (currentManifest.renderMode === 'static' && isStaticAnimationConfig(animConfig)) {
        // 静态模式：使用 StaticAnimator（单张立绘 + Canvas 变换动画）
        animatorRef.current = new StaticAnimator(fakeImage, animConfig)
      } else if (!isStaticAnimationConfig(animConfig)) {
        // 精灵图模式：使用 SpriteAnimator（逐帧动画）
        animatorRef.current = new SpriteAnimator(fakeImage, {
          ...animConfig,
          // frameSize 必须放在 spread 后面，确保始终使用 renderSize
          // （offscreen canvas 每帧固定为 renderSize x renderSize）
          frameSize: { width: PET_RENDER_SIZE, height: PET_RENDER_SIZE },
        })
      }

      // 动画结束回调：waking 切 idle；互动动画结束后恢复 petState 对应图片
      if (animatorRef.current) {
        animatorRef.current.onFinish = () => {
          if (currentStateRef.current === 'waking') {
            useAppStore.getState().setPetState('idle')
          }
          if (interactionEffectRef.current) {
            interactionEffectRef.current = null
            setupAnimator(resolveImageKey(currentStateRef.current))
          }
        }
      }
    },
    [manifest, resolveImageKey]
  )

  // 处理皮肤切换（含过渡动画）
  useEffect(() => {
    if (!manifest || !skinDir) return

    const t = transitionRef.current

    if (t.phase === 'none') {
      // 首次加载：直接加载，不做过渡
      if (Object.keys(scaledImagesRef.current).length === 0) {
        loadSkinImages(manifest, skinDir)
        t.alpha = 1
      } else {
        // 皮肤目录/manifest 变化 → 触发过渡
        t.pendingManifest = manifest
        t.pendingSkinDir = skinDir
        t.phase = 'fade-out'
        t.phaseStart = performance.now()
      }
    }
    // 如果正在过渡中，更新 pending 目标
    else {
      t.pendingManifest = manifest
      t.pendingSkinDir = skinDir
    }
  }, [manifest, skinDir, loadSkinImages])

  // manifest 变化时同步 HD 状态并更新 canvas 的 imageRendering，
  // 避免把 manifest 加入主渲染循环依赖（否则会重建整个渲染循环）
  useEffect(() => {
    hdRef.current = isHDSkin(manifest)
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.imageRendering = hdRef.current ? 'auto' : 'pixelated'
    }
  }, [manifest])

  // 状态决策:displayState 优先(主进程权威决策) > petState 兜底
  // 互动动作不受影响:互动期间由 startInteraction 直接调用 setupAnimator 切换动作图,
  // 互动结束后 animator.onFinish 会恢复到 resolveImageKey(currentStateRef.current)
  useEffect(() => {
    // 优先使用主进程侧的 displayState(权威决策)
    let targetState: string
    if (displayState?.state) {
      // unlockedStates 安全兜底:养成状态(非基础状态)未解锁时回退到 petState
      const isBaseState = displayState.state in STATE_IMAGE_MAP
      const isUnlocked = isBaseState || unlockedStates.includes(displayState.state)
      targetState = isUnlocked ? displayState.state : petState
    } else {
      // 兜底:无 displayState(主进程未实现)时用 petState,行为与改造前一致
      targetState = petState
    }

    if (targetState !== currentStateRef.current) {
      currentStateRef.current = targetState as PetState
      setupAnimator(resolveImageKey(targetState))
    }
    // 同步粒子系统状态(基础 PetState 有效;养成状态回退为 idle 配色)
    particleRef.current?.setState(targetState as PetState)
  }, [petState, displayState, unlockedStates, setupAnimator, resolveImageKey])

  // 监听主进程的互动类型触发(明确驱动动画,不依赖 satiety 变化量推断)
  // 旧实现:从 nurtureState.vitals.satiety 变化量 >= 15 推断喂食,但 clamp(satiety+20, 100)
  //         导致 satiety≥86 时实际增量 < 15,动画丢失。新实现由主进程 interact() 直接广播类型。
  useEffect(() => {
    const unsubscribe = window.desktopXPet.onNurtureInteractTrigger((type) => {
      if (type === 'feed') {
        // 喂食时清除悬停计时器，避免摸头覆盖吃饭
        if (strokeTimerRef.current) {
          clearTimeout(strokeTimerRef.current)
          strokeTimerRef.current = null
        }
        const interact = startInteraction('feed', 800)
        if (interact) {
          setupAnimator(interact.image)
        }
        setInteractionMessage('好吃!')
        particleRef.current?.burst({
          centerX: 0.5, centerY: 0.5, radius: 30,
          speedMin: 0.5, speedMax: 1.2,
          angleMin: -Math.PI, angleMax: 0,
          sizeMin: 4, sizeMax: 8,
          colors: [{ h: 35, s: 90, l: 65 }, { h: 25, s: 95, l: 60 }, { h: 45, s: 80, l: 70 }],
          hueShiftMin: 5, hueShiftMax: 15,
          lifeMin: 800, lifeMax: 1400,
          shapes: ['circle', 'sparkle'],
          gravity: 0.015,
          drag: 0.002,
        }, 8)
      }
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [setInteractionMessage, setupAnimator, startInteraction])

  // Canvas 渲染循环（整合精灵 + 粒子 + 阴影 + 光晕 + 过渡）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 主渲染循环不设置 willReadFrequently: true,保留 GPU 加速
    // 点击检测在 handleClick 中用临时 canvas 做像素读取,避免影响主循环性能
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

    // HD 皮肤使用双线性插值，像素皮肤使用最近邻
    const hd = hdRef.current
    ctx.imageSmoothingEnabled = hd
    if (hd) {
      ctx.imageSmoothingQuality = 'high'
    }

    // 动态设置 canvas CSS image-rendering（由独立的 manifest effect 同步 hdRef）
    if (canvas) {
      canvas.style.imageRendering = hd ? 'auto' : 'pixelated'
    }

    // 窗口可见性监听
    const onVisibility = (): void => {
      visibleRef.current = !document.hidden
      if (visibleRef.current && !rafIdRef.current) {
        transitionRef.current.lastFrame = performance.now()
        rafIdRef.current = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // 窗口焦点监听 — 失焦时降频，节省 CPU/GPU
    const onFocus = (): void => {
      isWindowFocusedRef.current = true
    }
    const onBlur = (): void => {
      isWindowFocusedRef.current = false
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)

    const particles = particleRef.current
    if (particles) particles.setSize(logicalSize, logicalSize)

    // 根据状态和焦点决定目标帧率
    // idle/sleeping 降频到 15fps（脉动缓慢，用户感知不到差异）
    // working/happy/error 降到 30fps（精灵图动画 ≤15fps，60fps 无视觉增益）
    // 失焦时降到 5fps（宠物不在用户视线焦点）
    const getTargetFps = (state: PetState): number => {
      if (!isWindowFocusedRef.current) return 5
      if (state === 'sleeping') return 10
      if (state === 'idle') return 15
      return 30
    }

    const render = (time: number): void => {
      if (!visibleRef.current) {
        rafIdRef.current = 0
        return
      }

      // 帧率控制：根据状态决定是否跳过本帧渲染
      const targetFps = getTargetFps(currentStateRef.current)
      const minInterval = 1000 / targetFps
      if (time - lastRenderTimeRef.current < minInterval) {
        rafIdRef.current = requestAnimationFrame(render)
        return
      }
      lastRenderTimeRef.current = time

      const t = transitionRef.current
      const delta = t.lastFrame ? time - t.lastFrame : 16
      t.lastFrame = time

      // --- 过渡动画更新 ---
      if (t.phase === 'fade-out') {
        const elapsed = time - t.phaseStart
        t.alpha = Math.max(0, 1 - elapsed / TRANSITION_FADE_OUT)
        if (elapsed >= TRANSITION_FADE_OUT) {
          t.alpha = 0
          // 在完全透明时加载新皮肤
          if (t.pendingManifest && t.pendingSkinDir) {
            const loadManifest = t.pendingManifest
            const loadDir = t.pendingSkinDir
            t.pendingManifest = null
            t.pendingSkinDir = ''
            loadSkinImages(loadManifest, loadDir).then(() => {
              // 加载完毕后检查：如果期间又有新皮肤请求，继续加载最新的
              if (t.pendingManifest && t.pendingSkinDir) {
                const nextManifest = t.pendingManifest
                const nextDir = t.pendingSkinDir
                t.pendingManifest = null
                t.pendingSkinDir = ''
                loadSkinImages(nextManifest, nextDir).then(() => {
                  t.phase = 'fade-in'
                  t.phaseStart = performance.now()
                })
              } else {
                t.phase = 'fade-in'
                t.phaseStart = performance.now()
              }
            })
          } else {
            t.phase = 'fade-in'
            t.phaseStart = performance.now()
          }
        }
      } else if (t.phase === 'fade-in') {
        const elapsed = time - t.phaseStart
        t.alpha = Math.min(1, elapsed / TRANSITION_FADE_IN)
        if (elapsed >= TRANSITION_FADE_IN) {
          t.alpha = 1
          t.phase = 'none'
        }
      }

      // --- 粒子更新 ---
      if (particles) particles.update(Math.min(delta, 100))

      // --- 渲染 ---
      ctx.clearRect(0, 0, logicalSize, logicalSize)

      const petAlpha = t.alpha
      const state = currentStateRef.current

      // 1) 状态环境光晕层：在宠物背后渲染柔和彩色光晕
      if (petAlpha > 0.05) {
        drawStateGlow(ctx, logicalSize, petAlpha, state, time, glowGradientCacheRef.current)
      }

      // 2) 阴影层：宠物下方柔和椭圆影
      if (petAlpha > 0.05) {
        drawShadow(ctx, logicalSize, petAlpha, state, time, shadowGradientCacheRef.current)
      }

      // 3) 精灵层：当前帧
      const animator = animatorRef.current
      if (animator && petAlpha > 0.01) {
        const frame = animator.tick(time)
        const interact = computeInteractionOffset(interactionEffectRef.current, time)

        ctx.save()
        ctx.globalAlpha = petAlpha

        const center = logicalSize / 2
        ctx.translate(center + interact.x, center + interact.y)
        ctx.scale(interact.scale, interact.scale)
        ctx.translate(-center, -center)

        if (animator instanceof StaticAnimator) {
          // 静态模式：应用配置的动画变换（浮动、呼吸、摇摆、弹跳）
          const transforms = animator.computeTransforms(time)
          ctx.translate(center + transforms.translateX, center + transforms.translateY)
          ctx.rotate(transforms.rotation)
          ctx.scale(transforms.scaleX, transforms.scaleY)
          ctx.translate(-center, -center)
        } else {
          // 精灵图模式：保留原有的微妙呼吸感
          const breathe = 1 + Math.sin(time * 0.002) * 0.008
          if (Math.abs(breathe - 1) > 0.001) {
            ctx.translate(center, center)
            ctx.scale(breathe, breathe)
            ctx.translate(-center, -center)
          }
        }

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

        ctx.restore()
      }

      // 4) 粒子层：渲染在精灵之上
      if (petAlpha > 0.3 && particles) {
        ctx.save()
        ctx.globalAlpha = petAlpha
        particles.render(ctx)
        ctx.restore()
      }

      rafIdRef.current = requestAnimationFrame(render)
    }

    transitionRef.current.lastFrame = performance.now()
    rafIdRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafIdRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [loadSkinImages])

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    window.desktopXPet.showContextMenu()
  }, [])

  // 双击打开仪表盘
  const handleDoubleClick = useCallback(() => {
    window.desktopXPet.openDashboard()
  }, [])

  // 点击互动：触发养成互动 + 粒子爆发 + 动作 + 文字
  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // 用临时 canvas 做像素检测,避免主 canvas 设置 willReadFrequently 损失 GPU 加速
    // drawImage 1x1 像素后 getImageData,性能开销极小
    const testCanvas = document.createElement('canvas')
    testCanvas.width = 1
    testCanvas.height = 1
    const testCtx = testCanvas.getContext('2d', { willReadFrequently: true })
    if (!testCtx) return
    const dpr = dprRef.current
    testCtx.drawImage(
      canvas,
      Math.floor(x * dpr), Math.floor(y * dpr), 1, 1,
      0, 0, 1, 1
    )
    const pixel = testCtx.getImageData(0, 0, 1, 1).data
    if (pixel[3] > 0) {
      // 点击优先级最高：清除悬停计时器，避免摸头覆盖跳跃
      if (strokeTimerRef.current) {
        clearTimeout(strokeTimerRef.current)
        strokeTimerRef.current = null
      }
      // 互动:更新养成属性 + 触发粒子特效 + 切跳跃帧 + 文字,不改变 petState
      window.desktopXPet.nurtureInteract('pet')
      window.desktopXPet.playSound('click')
      const interact = startInteraction('click', 450)
      if (interact) {
        setupAnimator(interact.image)
      }
      setInteractionMessage('开心~')
      // 轻量粒子爆发
      particleRef.current?.burst({
        centerX: 0.5, centerY: 0.42, radius: 28,
        speedMin: 0.6, speedMax: 1.4,
        angleMin: -Math.PI, angleMax: 0,
        sizeMin: 3, sizeMax: 6,
        colors: [{ h: 330, s: 90, l: 70 }, { h: 350, s: 85, l: 75 }],
        hueShiftMin: 5, hueShiftMax: 20,
        lifeMin: 700, lifeMax: 1300,
        shapes: ['heart', 'sparkle'],
        gravity: 0.008,
        drag: 0.002,
      }, 8)
    }
  }, [setInteractionMessage, setupAnimator, startInteraction])

  // 组件卸载时清理 strokeTimer
  useEffect(() => {
    return () => {
      if (strokeTimerRef.current) clearTimeout(strokeTimerRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pet-canvas"
      onClick={handleClick}
      onMouseDown={onMouseDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => {
        strokeTimerRef.current = setTimeout(() => {
          // 摸头优先级最低，若跳跃/吃饭正在执行则不覆盖
          const interact = startInteraction('stroke', 600)
          if (!interact) return
          window.desktopXPet.nurtureInteract('stroke')
          setInteractionMessage('舒服~')
          setupAnimator(interact.image)
          particleRef.current?.burst({
            centerX: 0.5, centerY: 0.35, radius: 25,
            speedMin: 0.4, speedMax: 1.0,
            angleMin: -Math.PI, angleMax: 0,
            sizeMin: 3, sizeMax: 6,
            colors: [{ h: 320, s: 85, l: 72 }, { h: 340, s: 90, l: 68 }],
            hueShiftMin: 5, hueShiftMax: 15,
            lifeMin: 800, lifeMax: 1400,
            shapes: ['heart', 'petal'],
            gravity: 0.004,
            drag: 0.001,
          }, 6)
        }, 1500)
      }}
      onMouseLeave={() => {
        if (strokeTimerRef.current) {
          clearTimeout(strokeTimerRef.current)
          strokeTimerRef.current = null
        }
      }}
    />
  )
}

/**
 * 各状态的环境光晕颜色 (HSL)
 */
const STATE_GLOW_COLORS: Record<string, { h: number; s: number; l: number }> = {
  idle: { h: 45, s: 80, l: 70 },
  working: { h: 210, s: 80, l: 65 },
  happy: { h: 320, s: 85, l: 70 },
  sleeping: { h: 230, s: 30, l: 50 },
  error: { h: 0, s: 90, l: 55 },
  waking: { h: 45, s: 80, l: 70 },
}

// 缓存光晕和阴影的 gradient（按 state 缓存，避免每帧重建）
// 注意：缓存移入组件 ref，模块级不再持有 CanvasGradient（避免跨 context 失效）

/**
 * 宠物背后的状态环境光晕 — 柔和的彩色辉光，随时间微妙脉动
 */
function drawStateGlow(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  alpha: number,
  state: PetState,
  time: number,
  cache: Map<string, CanvasGradient>
): void {
  const glow = STATE_GLOW_COLORS[state] || STATE_GLOW_COLORS.idle
  const cx = canvasSize / 2
  const cy = canvasSize * 0.48
  // 光晕半径随时间微妙脉动
  const pulse = 1 + Math.sin(time * 0.0015) * 0.06
  const radius = canvasSize * 0.42 * pulse

  ctx.save()
  ctx.globalAlpha = alpha * 0.12

  // 使用缓存的 gradient（按 state 缓存，半径用平均值避免每帧重建）
  let grad = cache.get(state)
  if (!grad) {
    const baseRadius = canvasSize * 0.42
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius)
    grad.addColorStop(0, `hsla(${glow.h}, ${glow.s}%, ${glow.l}%, 0.6)`)
    grad.addColorStop(0.5, `hsla(${glow.h}, ${glow.s}%, ${glow.l}%, 0.2)`)
    grad.addColorStop(1, `hsla(${glow.h}, ${glow.s}%, ${glow.l}%, 0)`)
    cache.set(state, grad)
  }

  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()
}

/**
 * 宠物下方的柔和阴影 — 根据状态微调颜色
 */
function drawShadow(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  alpha: number,
  state: PetState,
  time: number,
  cache: Map<string, CanvasGradient>
): void {
  ctx.save()
  const cx = canvasSize / 2
  const cy = canvasSize * 0.88
  const rx = canvasSize * 0.32
  const ry = canvasSize * 0.06

  // 阴影微妙脉动
  const pulse = 1 + Math.sin(time * 0.002) * 0.04
  ctx.globalAlpha = alpha * 0.25

  // 使用缓存的 shadow gradient（按 state 缓存）
  let grad = cache.get(state)
  if (!grad) {
    let shadowColor = 'rgba(0, 0, 0, 0.45)'
    let shadowEdge = 'rgba(0, 0, 0, 0.15)'
    if (state === 'error') {
      shadowColor = 'rgba(80, 0, 0, 0.4)'
      shadowEdge = 'rgba(60, 0, 0, 0.12)'
    } else if (state === 'happy') {
      shadowColor = 'rgba(40, 10, 40, 0.35)'
      shadowEdge = 'rgba(30, 5, 30, 0.1)'
    }

    const baseRx = canvasSize * 0.32
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRx)
    grad.addColorStop(0, shadowColor)
    grad.addColorStop(0.6, shadowEdge)
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    cache.set(state, grad)
  }

  ctx.beginPath()
  ctx.ellipse(cx, cy, rx * pulse, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()
}
