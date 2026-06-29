import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import type { SkinManifest } from '@shared/types'
import SkinPreviewCanvas from './SkinPreviewCanvas'

interface SkinItem {
  name: string
  dirName: string
  path: string
  previewUrl?: string
  manifest?: SkinManifest
}

/**
 * 皮肤选择器 UI — 浏览、预览、切换皮肤
 * 支持悬停动画预览 + 音效试听
 */
export default function SkinSelector() {
  const [skins, setSkins] = useState<SkinItem[]>([])
  const [hoveredSkin, setHoveredSkin] = useState<string | null>(null)
  const currentSkin = useAppStore((s) => s.currentSkin)

  useEffect(() => {
    let cancelled = false
    const loadSkins = async () => {
      try {
        const list = await window.desktopXPet.getSkinList()
        if (cancelled) return
        const withPreview = await Promise.all(
          list.map(async (skin: SkinItem) => {
            const basePath = skin.path.replace(/\\/g, '/')
            // 并行读取预览图和 manifest.json
            const [previewUrl, manifestData] = await Promise.all([
              window.desktopXPet.readSkinImage(`${basePath}/preview.png`),
              window.desktopXPet.readSkinImage(`${basePath}/manifest.json`),
            ])
            let manifest: SkinManifest | undefined
            if (manifestData) {
              try {
                const base64 = manifestData.split(',')[1]
                const binary = atob(base64)
                const bytes = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
                const text = new TextDecoder('utf-8').decode(bytes)
                manifest = JSON.parse(text)
              } catch {
                // manifest 解析失败时忽略，仅失去动画预览
              }
            }
            return { ...skin, previewUrl: previewUrl || undefined, manifest }
          })
        )
        if (cancelled) return
        setSkins(withPreview)
      } catch {
        // 忽略加载失败
      }
    }
    loadSkins()

    // 监听皮肤列表变更(用户通过右键菜单/托盘刷新皮肤后),重新加载
    const cleanup = window.desktopXPet.onSkinsChanged(() => {
      loadSkins()
    })

    // 监听等级提升导致的皮肤列表变更(新解锁的皮肤自动出现)
    const cleanupListChanged = window.desktopXPet.onSkinListChanged(() => {
      loadSkins()
    })

    return () => {
      cancelled = true
      cleanup()
      cleanupListChanged()
    }
  }, [])

  const handleSwitch = async (name: string) => {
    try {
      await window.desktopXPet.switchSkin(name)
      useAppStore.getState().setCurrentSkin(name)
    } catch {
      // 忽略切换失败
    }
  }

  const handlePlaySound = (e: React.MouseEvent, soundName: string): void => {
    e.stopPropagation()
    window.desktopXPet.playSound(soundName)
  }

  return (
    <div className="skin-selector">
      <h3 className="section-title">🎨 皮肤选择</h3>
      <div className="skin-grid">
        {skins.map((skin) => (
          <div
            key={skin.name}
            className={`skin-card ${currentSkin === skin.dirName || currentSkin === skin.name ? 'active' : ''}`}
            onClick={() => handleSwitch(skin.dirName)}
            onMouseEnter={() => setHoveredSkin(skin.name)}
            onMouseLeave={() => setHoveredSkin(null)}
          >
            <div className="skin-preview">
              {/* 悬停时显示动画预览,否则显示静态预览图 */}
              {hoveredSkin === skin.name && skin.manifest ? (
                <SkinPreviewCanvas skinPath={skin.path} manifest={skin.manifest} size={80} />
              ) : skin.previewUrl ? (
                <img src={skin.previewUrl} alt={skin.name} />
              ) : (
                <div className="skin-preview-placeholder">🎨</div>
              )}
            </div>
            <div className="skin-name">{skin.name}</div>
            {(currentSkin === skin.dirName || currentSkin === skin.name) && <div className="skin-badge">当前</div>}
            {/* 音效试听按钮 */}
            <div className="skin-actions">
              <button
                className="skin-sound-btn"
                title="试听点击音效"
                onClick={(e) => handlePlaySound(e, 'click')}
              >
                🔊
              </button>
              <button
                className="skin-sound-btn"
                title="试听完成音效"
                onClick={(e) => handlePlaySound(e, 'complete')}
              >
                ✅
              </button>
            </div>
          </div>
        ))}
        {skins.length === 0 && <div className="empty-state">暂无可用皮肤</div>}
      </div>
    </div>
  )
}
