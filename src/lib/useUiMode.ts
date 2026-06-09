import type { UIMode } from './types'

/**
 * Ohana 现在只提供一套清楚、易用的家庭界面。
 * 保留这个 hook 作为既有组件的兼容层，避免旧数据或页面分支出错。
 */
export function useUiMode(): UIMode {
  return 'standard'
}

/** 旧页面兼容：统一家庭版不再切换到单独的大字模式。 */
export function useIsElder(): boolean {
  return false
}

/** 保留旧名字以避免大面积改动。 */
export const useIsSimpleMode = useIsElder
