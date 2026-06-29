import { useEffect, useState, useCallback, useRef } from 'react'
import PetCanvas from './components/Pet/PetCanvas'
import StatusBubble from './components/StatusBubble/StatusBubble'
import StatusDetailPopup from './components/StatusDetail/StatusDetailPopup'
import Dashboard from './components/Dashboard/Dashboard'
import { useAppStore, initAppStore } from './stores/appStore'
import { useIdleTimer } from './hooks/useIdleTimer'
import type { SkinManifest, AggregatedStatus, MonitorStatus, PetNurtureState, NurtureBroadcast } from '@shared/types'
import type { SkinListItem } from '../preload/index'

function App() {
  const [isDashboard, setIsDashboard] = useState(false)
  // 闲置睡眠时间（分钟）— 从设置读取，默认 15 分钟
  const [sleepAfterMinutes, setSleepAfterMinutes] = useState(15)
  // 记录上次 error 状态的工具集合，用于音效去重（避免持续 error 时重复播放）
  const lastErrorKeyRef = useRef<string | null>(null)

  useEffect(() => {
    setIsDashboard(window.location.hash === '#/dashboard')
  }, [])

  const setPetState = useAppStore((s) => s.setPetState)
  const setCurrentSkin = useAppStore((s) => s.setCurrentSkin)

  const [manifest, setManifest] = useState<SkinManifest | null>(null)
  const [skinDir, setSkinDir] = useState<string>('')

  // 加载当前皮肤
  const loadSkin = useCallback(
    async (skinName: string) => {
      try {
        const skins = await window.desktopXPet.getSkinList()
        const skin = skins.find((s: SkinListItem) => s.dirName === skinName || s.name === skinName)
        if (skin) {
          const manifestPath = `${skin.path.replace(/\\/g, '/')}/manifest.json`
          const manifestData = await window.desktopXPet.readSkinImage(manifestPath)
          if (manifestData) {
            const base64 = manifestData.split(',')[1]
            const binary = atob(base64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            const text = new TextDecoder('utf-8').decode(bytes)
            const data = JSON.parse(text)
            setManifest(data)
          }
          setSkinDir(skin.path.replace(/\\/g, '/'))
          // 优先存 dirName,兼容传入 manifest.name 的旧值
          setCurrentSkin(skin.dirName)
        }
      } catch (err) {
        console.error('Failed to load skin:', skinName, err)
      }
    },
    [setCurrentSkin]
  )

  // 初始化 — 只运行一次，正确清理监听器
  useEffect(() => {
    let cleanupStatus: (() => void) | undefined
    let cleanupSkin: (() => void) | undefined
    let cleanupNurture: (() => void) | undefined
    let cleanupDisplayState: (() => void) | undefined
    let cleanupFeedback: (() => void) | undefined

    async function init() {
      // 初始化 appStore 副作用(加载 petName、注册跨窗口监听、加载 showBubble)
      await initAppStore()
      const settings = await window.desktopXPet.getSettings()
      const skinName = settings?.skin?.current || 'default-cat'
      // 读取用户配置的闲置睡眠时间
      if (settings?.behavior?.sleepAfterMinutes) {
        setSleepAfterMinutes(settings.behavior.sleepAfterMinutes)
      }
      await loadSkin(skinName)

      cleanupSkin = window.desktopXPet.onSkinChanged((newSkin: string) => {
        loadSkin(newSkin)
      })

      cleanupStatus = window.desktopXPet.onStatusUpdate((status: AggregatedStatus) => {
        if (!status || !status.petState) return

        if (status.petState === 'happy' && status.newCompleted) {
          // 同一 completed 事件只播放一次声音（由 MonitorService 去重）
          window.desktopXPet.playSound('complete')
        } else if (status.petState === 'error') {
          // 同一 error 工具集合只播放一次音效（避免持续 error 时重复播放）
          const errorKey = (status.tools || [])
            .filter((t: MonitorStatus) => t.status === 'error')
            .map((t: MonitorStatus) => t.tool)
            .join(',')
          if (errorKey !== lastErrorKeyRef.current) {
            lastErrorKeyRef.current = errorKey
            window.desktopXPet.playSound('error')
          }
        } else {
          // 非 error 状态重置，下次进入 error 时会再次播放
          lastErrorKeyRef.current = null
        }
        useAppStore.getState().setMonitorData(status)
      })

      // 拉取初始养成状态
      try {
        const nurtureState = await window.desktopXPet.getNurtureState()
        if (nurtureState) useAppStore.getState().setNurtureState(nurtureState)
      } catch (err) {
        console.warn('Failed to load nurture state:', err)
      }

      // 监听养成状态更新
      cleanupNurture = window.desktopXPet.onNurtureUpdate((state: PetNurtureState) => {
        useAppStore.getState().setNurtureState(state)
      })

      // 监听养成显示状态广播(主进程侧权威决策:含 displayState + unlockedStates)
      cleanupDisplayState = window.desktopXPet.onNurtureDisplayState((data: NurtureBroadcast) => {
        useAppStore.getState().setNurtureState(data.nurtureState)
        useAppStore.getState().setUnlockedStates(data.unlockedStates)
        useAppStore.getState().setDisplayState(data.displayState ?? null)
      })

      // 监听互动反馈(如饱食度已满时"吃饱了~"),由 StatusBubble 显示气泡
      cleanupFeedback = window.desktopXPet.onNurtureInteractFeedback((message: string) => {
        useAppStore.getState().setInteractionMessage(message)
      })
    }
    init()

    return () => {
      cleanupStatus?.()
      cleanupSkin?.()
      cleanupNurture?.()
      cleanupDisplayState?.()
      cleanupFeedback?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 拖拽安装 .xpet 皮肤包
  useEffect(() => {
    const handleDragOver = (e: DragEvent): void => {
      // 阻止默认行为,允许 drop
      e.preventDefault()
      e.stopPropagation()
    }
    const handleDrop = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
      e.stopPropagation()
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // 只处理 .xpet 文件
        if (!file.name.toLowerCase().endsWith('.xpet')) continue
        try {
          const filePath = window.desktopXPet.getPathForFile(file)
          const result = await window.desktopXPet.installSkinPackage(filePath)
          if (result.success) {
            console.log(`皮肤 "${result.skinName}" 安装成功`)
          } else {
            console.warn(`皮肤安装失败: ${result.error}`)
          }
        } catch (err) {
          console.error('皮肤安装出错:', err)
        }
      }
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  // 闲置睡眠
  const handleIdle = useCallback(() => {
    setPetState('sleeping')
  }, [setPetState])

  const handleActivity = useCallback(() => {
    // 只在 sleeping 状态时唤醒，不覆盖 working/error/happy 等状态
    const current = useAppStore.getState().petState
    if (current === 'sleeping') {
      setPetState('idle')
    }
  }, [setPetState])

  const { resetTimer, stopTimer } = useIdleTimer(sleepAfterMinutes, handleIdle, handleActivity)

  // 鼠标活动时重置闲置计时器（节流：1 秒内最多重置一次，避免 mousemove 高频调用）
  useEffect(() => {
    let lastReset = 0
    const handleAnyActivity = () => {
      const now = Date.now()
      if (now - lastReset >= 1000) {
        lastReset = now
        resetTimer()
      }
    }
    document.addEventListener('mousemove', handleAnyActivity)
    document.addEventListener('mousedown', handleAnyActivity)

    resetTimer()

    return () => {
      document.removeEventListener('mousemove', handleAnyActivity)
      document.removeEventListener('mousedown', handleAnyActivity)
      stopTimer()
    }
  }, [resetTimer, stopTimer])

  const isWindowHovered = useAppStore((s) => s.isWindowHovered)
  const setWindowHovered = useAppStore((s) => s.setWindowHovered)

  // 在 document 级别监听鼠标是否在窗口内，用于展开详情面板
  useEffect(() => {
    let hoverTimer: ReturnType<typeof setTimeout> | null = null
    let lastState = false
    let lastMoveTime = 0
    let lastHoverCheck = 0 // 节流：上次处理 hover 检测的时间

    const updateHover = (hovering: boolean) => {
      if (hovering === lastState) return
      lastState = hovering
      setWindowHovered(hovering)
      window.desktopXPet.setHoverState(hovering)
    }

    // 启动时重置为未悬停，防止上次异常状态遗留
    updateHover(false)

    const handleMouseMove = (e: MouseEvent) => {
      lastMoveTime = performance.now()
      // 节流：500ms 内最多处理一次 hover 检测，减少 mousemove 高频触发开销
      if (lastMoveTime - lastHoverCheck < 500) return
      lastHoverCheck = lastMoveTime
      const inWindow =
        e.clientX >= 0 &&
        e.clientX <= window.innerWidth &&
        e.clientY >= 0 &&
        e.clientY <= window.innerHeight
      if (inWindow) {
        if (hoverTimer) {
          clearTimeout(hoverTimer)
          hoverTimer = null
        }
        updateHover(true)
      }
    }

    const handleMouseLeave = () => {
      if (hoverTimer) clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => updateHover(false), 80)
    }

    const handleMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget) return
      const outOfWindow =
        e.clientX < -2 ||
        e.clientX > window.innerWidth + 2 ||
        e.clientY < -2 ||
        e.clientY > window.innerHeight + 2
      if (outOfWindow) {
        if (hoverTimer) clearTimeout(hoverTimer)
        hoverTimer = setTimeout(() => updateHover(false), 80)
      }
    }

    // 心跳兜底：透明穿透窗口下 mouseleave/mouseout 可能不触发，
    // 若已悬停但长时间未收到 mousemove，自动重置为未悬停
    const heartbeat = setInterval(() => {
      // 未悬停时直接跳过，避免无谓的 performance.now 调用
      if (!lastState) return
      if (performance.now() - lastMoveTime > 600) {
        updateHover(false)
      }
    }, 300)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseout', handleMouseOut)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseout', handleMouseOut)
      if (hoverTimer) clearTimeout(hoverTimer)
      clearInterval(heartbeat)
    }
  }, [setWindowHovered])

  if (isDashboard) {
    return <Dashboard />
  }

  return (
    <div className={`pet-container ${isWindowHovered ? 'window-hovered' : ''}`}>
      <PetCanvas skinDir={skinDir} manifest={manifest} />
      <StatusBubble />
      <StatusDetailPopup />
    </div>
  )
}

export default App
