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

// 状态触发条件(AND 组合,所有条件都满足才触发)
// field 扩展支持 'level'(等级触发)和 'event'(事件触发)
export const StateTriggerSchema = z.object({
  field: z.enum(['mood', 'satiety', 'energy', 'intimacy', 'level', 'event']),
  op: z.enum(['lt', 'gt', 'lte', 'gte', 'eq', 'ne']),
  // vital 字段为 0-100 数值;level 为正整数;event 为事件名字符串
  value: z.union([z.number().min(0), z.string().min(1)]),
})

// 皮肤状态配置
export const SkinStateConfigSchema = z.object({
  // 状态名,如 'hungry'/'sad'/'excited'
  name: z.string().min(1),
  // 对应 PNG 文件名(不含扩展名)
  image: z.string(),
  category: z.enum(['emotion', 'physiological', 'behavior']),
  // AND 组合,全部满足才触发
  triggers: z.array(StateTriggerSchema).min(1),
  // 数值越大越优先(默认 50)
  priority: z.number().int().default(50),
  // 解锁等级,默认 1
  unlockLevel: z.number().int().min(1).default(1),
  // 该状态专属冷却,覆盖全局默认
  cooldownMs: z.number().int().min(0).optional(),
})

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
  // 声明式互动动作:可选,旧 manifest 无此字段时走默认动作(jump/eat/stroke)
  actions: z
    .array(
      z.object({
        // 动作名,如 'jump'/'eat'/'stroke'/'custom'
        name: z.string().min(1),
        // 触发方式
        trigger: z.enum(['click', 'feed', 'stroke']),
        // 对应 PNG 文件名(不含扩展名),如 'jump'
        image: z.string(),
        // 优先级,数字越大越优先(1-10,默认 1)
        priority: z.number().int().min(1).max(10).default(1),
      })
    )
    .optional(),
  // 皮肤状态配置:可选,旧 manifest 无此字段时行为不变
  states: z.array(SkinStateConfigSchema).optional(),
  // 皮肤解锁等级(皮肤级别):未达到等级的皮肤在 SkinSelector 中完全隐藏
  // 与 states[].unlockLevel(状态级别)不同,此字段控制整个皮肤是否可见
  // 默认 1(初始可用),旧 manifest 无此字段时默认 unlockLevel=1,所有等级可见(向后兼容)
  unlockLevel: z.number().int().min(1).default(1),
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
