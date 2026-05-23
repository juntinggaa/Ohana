/**
 * llmClient · 统一 LLM 接入层 · DeepSeek 主线
 *
 * 设计：
 *   1. 优先调真实 DeepSeek（chat 接口，OpenAI 兼容）
 *   2. 没有 key 时回退到本地确定性逻辑（mock）
 *   3. 调用失败时回退到 mock，不让 UI 死掉
 *
 * ⚠️ 当前实现把 key 通过 VITE_ 暴露到前端。这对本地 demo OK，
 *    但部署到 Vercel 时必须改成走后端 /api/llm 路由，否则浏览器开发者工具能看到 key。
 */

export type LLMMode = 'mock' | 'remote'

export interface LLMResponse<T> {
  mode: LLMMode
  data: T
  mockNote?: string
  /** 当 remote 调用失败时填入错误说明，UI 可选展示 */
  remoteError?: string
  /** 远程返回的原文，调试用 */
  rawText?: string
}

const env = (import.meta as { env?: Record<string, string> }).env ?? {}
const DEEPSEEK_KEY = env.VITE_DEEPSEEK_API_KEY ?? ''
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1'

export function getLLMMode(): LLMMode {
  return DEEPSEEK_KEY ? 'remote' : 'mock'
}

export function hasDeepSeekKey(): boolean {
  return Boolean(DEEPSEEK_KEY)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  system: string
  user: string
  /** 期望返回 JSON */
  json?: boolean
  temperature?: number
  model?: 'deepseek-chat' | 'deepseek-reasoner'
}

/**
 * 低层调用 · 直接调 DeepSeek，返回字符串内容。
 */
export async function callDeepSeek(opts: ChatOptions): Promise<string> {
  if (!DEEPSEEK_KEY) {
    throw new Error('No DeepSeek API key. Add VITE_DEEPSEEK_API_KEY to .env')
  }

  const body = {
    model: opts.model ?? 'deepseek-chat',
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ] satisfies ChatMessage[],
    temperature: opts.temperature ?? 0.3,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  }

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DeepSeek ${res.status}: ${text || res.statusText}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('DeepSeek returned no content')
  }
  return content
}

/**
 * 高层 helper · 带 fallback 的远程调用，UI 可以直接用。
 *
 * - 没 key → 直接返回 fallback，mode='mock'
 * - 有 key 但调用失败 → 返回 fallback + remoteError，mode='mock'
 * - 有 key 且成功 → 调用 parse 解析远程文本
 */
export async function callRemoteWithFallback<T>(args: {
  fallback: T
  mockNote: string
  remote?: () => Promise<T>
}): Promise<LLMResponse<T>> {
  const { fallback, mockNote, remote } = args
  if (!hasDeepSeekKey() || !remote) {
    return { mode: 'mock', data: fallback, mockNote }
  }
  try {
    const data = await remote()
    return { mode: 'remote', data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[LLM] remote failed, falling back to local logic:', msg)
    return {
      mode: 'mock',
      data: fallback,
      mockNote: '远程调用失败，已回退到本地逻辑',
      remoteError: msg,
    }
  }
}

/**
 * 兼容老接口 —— 三个 Agent 早期版本使用的 callRemote。
 * @deprecated 用 callRemoteWithFallback 代替。
 */
export async function callRemote<T>(
  _prompt: string,
  fallback: T,
  mockNote: string,
): Promise<LLMResponse<T>> {
  return { mode: 'mock', data: fallback, mockNote }
}

/**
 * Helper · 尝试从模型返回里抽 JSON。模型有时会包 markdown 代码块。
 */
export function extractJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    // try to find a ```json ... ``` block
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        return JSON.parse(match[1]) as T
      } catch {
        return null
      }
    }
    return null
  }
}
