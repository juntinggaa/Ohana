/**
 * llmClient · 统一 LLM 接入层
 *
 * 当前 provider · OpenRouter (走 deepseek-chat-v3)
 *
 * 设计：
 *   1. 优先调真实 LLM（OpenAI 兼容接口 · /chat/completions）
 *   2. 没有 key 时回退到本地确定性逻辑（mock）
 *   3. 调用失败时回退到 mock，不让 UI 死掉
 *
 * Env vars (按优先级)：
 *   - VITE_OPENROUTER_API_KEY  · 推荐
 *   - VITE_DEEPSEEK_API_KEY    · 老 key 名 · 兼容用
 *
 * ⚠️ 当前实现把 key 通过 VITE_ 暴露到前端。这对本地 demo / 黑客松 OK，
 *    但生产环境务必走后端代理（例如 /api/llm 路由），否则浏览器开发者工具能看到 key。
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
// 优先用 OPENROUTER · 兼容老的 DEEPSEEK 变量名
const LLM_KEY = env.VITE_OPENROUTER_API_KEY ?? env.VITE_DEEPSEEK_API_KEY ?? ''
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
// OpenRouter 上 DeepSeek-V3 的型号名（rolling alias）
const DEFAULT_MODEL = 'deepseek/deepseek-chat'

export function getLLMMode(): LLMMode {
  return LLM_KEY ? 'remote' : 'mock'
}

/** 保留旧名，外部调用点不用改 */
export function hasDeepSeekKey(): boolean {
  return Boolean(LLM_KEY)
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
  /** OpenRouter 上的模型名，省略时走 deepseek-chat-v3 */
  model?: string
}

/**
 * 低层调用 · 走 OpenRouter，OpenAI 兼容协议。
 * 函数名保留 callDeepSeek 是为了让既有调用点不动。
 */
export async function callDeepSeek(opts: ChatOptions): Promise<string> {
  if (!LLM_KEY) {
    throw new Error(
      'No LLM API key. Add VITE_OPENROUTER_API_KEY to your .env or Vercel env.',
    )
  }

  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ] satisfies ChatMessage[],
    temperature: opts.temperature ?? 0.3,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_KEY}`,
      // OpenRouter 推荐这两个，用于他们的统计面板（可缺省）
      'HTTP-Referer':
        typeof window !== 'undefined' ? window.location.origin : 'https://ohana.app',
      'X-Title': 'Ohana · 欧哈娜',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${text || res.statusText}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('OpenRouter returned no content')
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
