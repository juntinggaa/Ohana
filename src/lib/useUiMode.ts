import { useAppStore } from './store'
import type { UIMode } from './types'

/**
 * Resolve current UI mode based on:
 *   1) explicit override in store (`uiModeOverride`)
 *   2) current user's `uiMode` field (老 / 标准)
 *   3) default: standard
 *
 * 现在只有两个模式：
 *   - standard  · 家人通用（包括协调者）
 *   - elder     · 大字、大按钮、只剩最关键的一两件事
 */
export function useUiMode(): UIMode {
  return useAppStore((s) => {
    if (s.uiModeOverride === 'elder') return 'elder'
    if (s.uiModeOverride === 'standard') return 'standard'
    // auto
    const user = s.familyMembers.find((m) => m.id === s.currentUserId)
    if (user?.uiMode === 'elder') return 'elder'
    return 'standard'
  })
}

/** 是否老人模式 · 给组件做大字 / 简化判断 */
export function useIsElder(): boolean {
  return useUiMode() === 'elder'
}

/** 保留旧名字以避免大面积改动 · 现在等同于 useIsElder */
export const useIsSimpleMode = useIsElder
