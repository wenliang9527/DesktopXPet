import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'

interface SkinItem {
  name: string
  path: string
  previewUrl?: string
  manifest?: any
}

/**
 * 皮肤选择器 UI — 浏览、预览、切换皮肤
 */
export default function SkinSelector() {
  const [skins, setSkins] = useState<SkinItem[]>([])
  const currentSkin = useAppStore((s) => s.currentSkin)

  useEffect(() => {
    loadSkins()
  }, [])

  const loadSkins = async () => {
    const list = await window.desktopXPet.getSkinList()
    const withPreview = await Promise.all(
      list.map(async (skin: any) => {
        const previewPath = `${skin.path.replace(/\\/g, '/')}/preview.png`
        const dataUrl = await window.desktopXPet.readSkinImage(previewPath)
        return { ...skin, previewUrl: dataUrl || undefined }
      })
    )
    setSkins(withPreview)
  }

  const handleSwitch = async (name: string) => {
    await window.desktopXPet.switchSkin(name)
    useAppStore.getState().setCurrentSkin(name)
  }

  return (
    <div className="skin-selector">
      <h3 className="section-title">🎨 皮肤选择</h3>
      <div className="skin-grid">
        {skins.map((skin) => (
          <div
            key={skin.name}
            className={`skin-card ${currentSkin === skin.name ? 'active' : ''}`}
            onClick={() => handleSwitch(skin.name)}
          >
            <div className="skin-preview">
              {skin.previewUrl ? (
                <img src={skin.previewUrl} alt={skin.name} />
              ) : (
                <div className="skin-preview-placeholder">🎨</div>
              )}
            </div>
            <div className="skin-name">{skin.name}</div>
            {currentSkin === skin.name && <div className="skin-badge">当前</div>}
          </div>
        ))}
        {skins.length === 0 && <div className="empty-state">暂无可用皮肤</div>}
      </div>
    </div>
  )
}
