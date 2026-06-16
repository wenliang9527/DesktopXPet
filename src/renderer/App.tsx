import { useEffect, useState, useCallback } from 'react'
import PetCanvas from './components/Pet/PetCanvas'
import StatusBubble from './components/StatusBubble/StatusBubble'
import Dashboard from './components/Dashboard/Dashboard'
import { useAppStore } from './stores/appStore'
import { useIdleTimer } from './hooks/useIdleTimer'
import type { SkinManifest } from '@shared/types'

function App() {
  const [isDashboard, setIsDashboard] = useState(false)

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
        const skin = skins.find((s: any) => s.dirName === skinName || s.name === skinName)
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
          setCurrentSkin(skinName)
        }
      } catch (err) {
        console.error('Failed to load skin:', skinName, err)
      }
    },
    [setCurrentSkin]
  )

  // 初始化
  useEffect(() => {
    async function init() {
      const settings = await window.desktopXPet.getSettings()
      const skinName = settings?.skin?.current || 'default-cat'
      await loadSkin(skinName)

      window.desktopXPet.onSkinChanged((newSkin: string) => {
        loadSkin(newSkin)
      })

      window.desktopXPet.onStatusUpdate((status: any) => {
        if (status.petState) {
          // 状态变化时播放音效
          if (status.petState === 'happy') {
            window.desktopXPet.playSound('complete')
          } else if (status.petState === 'error') {
            window.desktopXPet.playSound('error')
          }
          setPetState(status.petState)
        }
        useAppStore.getState().setSummary(status.summary || 'DesktopXPet 待机中')
      })
    }
    init()
  }, [loadSkin, setPetState])

  // 闲置睡眠
  const handleIdle = useCallback(() => {
    setPetState('sleeping')
  }, [setPetState])

  const handleActivity = useCallback(() => {
    setPetState('idle')
  }, [setPetState])

  const { resetTimer, stopTimer } = useIdleTimer(15, handleIdle, handleActivity)

  // 鼠标活动时重置闲置计时器
  useEffect(() => {
    const handleAnyActivity = () => resetTimer()
    document.addEventListener('mousemove', handleAnyActivity)
    document.addEventListener('mousedown', handleAnyActivity)

    resetTimer()

    return () => {
      document.removeEventListener('mousemove', handleAnyActivity)
      document.removeEventListener('mousedown', handleAnyActivity)
      stopTimer()
    }
  }, [resetTimer, stopTimer])

  if (isDashboard) {
    return <Dashboard />
  }

  return (
    <div className="pet-container">
      <PetCanvas skinDir={skinDir} manifest={manifest} />
      <StatusBubble />
    </div>
  )
}

export default App
