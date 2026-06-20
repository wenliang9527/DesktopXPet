/**
 * 内置皮肤枚举
 * 统一管理皮肤名称，避免字符串魔法值
 */
export const BUILTIN_SKINS = [
  'default-cat',
  'butterfly-swordsman',
  'butterfly-swordsman-hd',
  'professional-team',
  'reze',
] as const

export type BuiltinSkinName = (typeof BUILTIN_SKINS)[number]
export type SkinName = BuiltinSkinName | string

export const DEFAULT_SKIN: BuiltinSkinName = BUILTIN_SKINS[0]
