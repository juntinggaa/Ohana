/**
 * llmClient · 统一 LLM 接入层
 *
 * 设计原则：
 *   1. 无 API Key 也能跑：自动回退到本地确定性 mock。
 *   2. 任何调用都标注 mode（'mock' | 'remote'），UI 可以诚实地告诉用户当前正在用什么。
 *   3. 明天要接真实模型时，只改这一个文件即可。
 *
 * ⚠️ 不要在前端打包真实 API Key。生产请走后端代理。
 */

export type LLMMode = 'mock' | 'remote'

export interface LLMResponse<T> {
  mode: LLMMode
  data: T
  /** 仅在 mock 模式下用于 UI 展示"这段是确定性逻辑算出来的，不是 LLM 写的" */
  mockNote?: string
}

function hasAnyApiKey(): boolean {
  // Vite 暴露 import.meta.env. 这些值需要前缀 VITE_ 才会被前端读取。
  // 我们在 .env.example 里使用不带 VITE_ 的名字 —— 因为它们的真实位置应在后端。
  const env = (import.meta as { env?: Record<string, string> }).env ?? {}
  return Boolean(
    env.VITE_OPENAI_API_KEY ||
      env.VITE_ANTHROPIC_API_KEY ||
      env.VITE_DEEPSEEK_API_KEY,
  )
}

/**
 * 当前是否处于 Mock 模式 —— UI 可以读这个值显示一个角标。
 */
export function getLLMMode(): LLMMode {
  return hasAnyApiKey() ? 'remote' : 'mock'
}

/**
 * 占位的远程调用 —— 明天接入真实模型时替换 fetch 实现。
 *
 * TODO(tomorrow):
 *   1. 接入 DeepSeek / OpenAI chat completions
 *   2. 把以下函数 wired 到真实端点：
 *        - analyzeFamilyMessages
 *        - generateCareWorkflow
 *        - analyzeResponsibilityTransfer
 *        - generateMentalLoadSummary
 *   3. 在 server 端做 prompt 注入防护和速率限制
 */
export async function callRemote<T>(
  _prompt: string,
  fallback: T,
  mockNote: string,
): Promise<LLMResponse<T>> {
  // 没 key 直接走 mock
  if (getLLMMode() === 'mock') {
    return { mode: 'mock', data: fallback, mockNote }
  }
  // 暂未实现远程链路 —— 留 TODO
  // const res = await fetch('/api/llm', { method: 'POST', body: JSON.stringify({ prompt }) })
  // const data = await res.json() as T
  // return { mode: 'remote', data }
  return { mode: 'mock', data: fallback, mockNote: '远程通道未启用，回退到本地逻辑' }
}
