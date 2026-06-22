import { z } from 'zod'

/**
 * 皮肤 manifest 的 zod schema
 * 在 skin-loader 加载时校验,防止字段缺失/类型错误导致运行时崩溃
 */

// 精灵图动画配置 (逐帧模式)
export const SpritesheetAnimationConfigSchema = z.object({
  // 帧数
  frames: z.number().int().positive(),
  // 帧率(fps)
  fps: z.number().positive(),
  // 是否循环
  loop: z.boolean(),
  // 可选:单帧尺寸(覆盖 manifest 顶层 frameSize)
  frameSize: z
    .object({
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
})

// 静态动画效果
export const StaticEffectSchema = z.object({
  type: z.enum(['float', 'breathe', 'sway', 'bounce']),
  speed: z.number().positive().optional(),
  intensity: z.number().positive().optional(),
})

// 静态动画配置 (立绘模式)
export const StaticAnimationConfigSchema = z.object({
  effects: z.array(StaticEffectSchema).min(1),
  duration: z.number().positive().optional(),
})

// 动画配置：支持精灵图模式或静态模式
export const AnimationConfigSchema = z.union([
  SpritesheetAnimationConfigSchema,
  StaticAnimationConfigSchema,
])

// 皮肤 manifest
export const SkinManifestSchema = z.object({
  // 皮肤名称(唯一标识)
  name: z.string().min(1),
  // 作者
  author: z.string().default('unknown'),
  // 版本
  version: z.string().default('1.0.0'),
  // 预览图文件名
  preview: z.string().default('preview.png'),
  // 描述
  description: z.string().optional(),
  // 整体帧尺寸
  frameSize: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  // 动画配置(键为状态名:idle/working/happy/sleeping/error/waking)
  animations: z.record(z.string(), AnimationConfigSchema),
  // 显示缩放因子
  displayScale: z.number().positive().optional(),
  // 渲染模式: 'spritesheet'(逐帧精灵图,默认) 或 'static'(静态立绘+Canvas动画)
  renderMode: z.enum(['spritesheet', 'static']).optional(),
})

/**
 * 校验 manifest.json 解析后的对象
 * @returns 校验成功返回强类型的 SkinManifest,失败返回 null
 */
export function validateSkinManifest(raw: unknown): z.infer<typeof SkinManifestSchema> | null {
  const result = SkinManifestSchema.safeParse(raw)
  if (!result.success) {
    return null
  }
  return result.data
}

/**
 * 校验并返回错误信息(用于日志)
 */
export function validateSkinManifestWithErrors(
  raw: unknown
): { data: z.infer<typeof SkinManifestSchema> } | { errors: string[] } {
  const result = SkinManifestSchema.safeParse(raw)
  if (!result.success) {
    return {
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    }
  }
  return { data: result.data }
}
