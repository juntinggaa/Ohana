/**
 * llmClient · 统一 LLM 接入层
 *
 * 支持 provider · DeepSeek 官方 API 或 OpenRouter
 *
 * 设计：
 *   1. 优先调真实 LLM（OpenAI 兼容接口 · /chat/completions）
 *   2. 没有 key 时回退到本地确定性逻辑（mock）
 *   3. 调用失败时回退到 mock，不让 UI 死掉
 *
 * Env vars (按优先级)：
 *   - VITE_OPENROUTER_API_KEY  · 走 OpenRouter
 *   - VITE_DEEPSEEK_API_KEY    · 走 DeepSeek 官方 API
 *
 * ⚠️ 当前实现把 key 通过 VITE_ 暴露到前端。这对本地 demo / 黑客松 OK，
 *    但生产环境务必走后端代理（例如 /api/llm 路由），否则浏览器开发者工具能看到 key。
 */

export type LLMMode = 'mock' | 'remote'
export type LLMProvider = 'openrouter' | 'deepseek'

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
const OPENROUTER_KEY = env.VITE_OPENROUTER_API_KEY?.trim() ?? ''
const DEEPSEEK_KEY = env.VITE_DEEPSEEK_API_KEY?.trim() ?? ''

interface ProviderConfig {
  id: LLMProvider
  displayName: string
  key: string
  baseUrl: string
  defaultModel: string
}

function providerConfig(): ProviderConfig | null {
  if (OPENROUTER_KEY) {
    return {
      id: 'openrouter',
      displayName: 'OpenRouter',
      key: OPENROUTER_KEY,
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'deepseek/deepseek-chat',
    }
  }
  if (DEEPSEEK_KEY) {
    return {
      id: 'deepseek',
      displayName: 'DeepSeek',
      key: DEEPSEEK_KEY,
      baseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-v4-flash',
    }
  }
  return null
}

export function getLLMMode(): LLMMode {
  return providerConfig() ? 'remote' : 'mock'
}

export function getLLMProvider(): LLMProvider | null {
  return providerConfig()?.id ?? null
}

export function getLLMProviderLabel(): string | null {
  return providerConfig()?.displayName ?? null
}

export function getLLMModelLabel(): string | null {
  return providerConfig()?.defaultModel ?? null
}

/** 保留旧名，外部调用点不用改 */
export function hasDeepSeekKey(): boolean {
  return Boolean(providerConfig())
}

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  system: string
  user: string
  /** 当前提问之前的同一私聊上下文，不包含 system 与当前 user。 */
  history?: LLMChatMessage[]
  /** 期望返回 JSON */
  json?: boolean
  temperature?: number
  /** 当前 provider 上的模型名；省略时走该 provider 的默认 DeepSeek 模型 */
  model?: string
}

/**
 * 低层调用 · 根据配置好的 key 选择对应 provider，使用 OpenAI 兼容协议。
 * 函数名保留 callDeepSeek 是为了让既有调用点不动。
 */
export async function callDeepSeek(opts: ChatOptions): Promise<string> {
  const provider = providerConfig()
  if (!provider) {
    throw new Error(
      'No LLM API key. Add VITE_DEEPSEEK_API_KEY or VITE_OPENROUTER_API_KEY to your .env or Vercel env.',
    )
  }

  const body = {
    model: opts.model ?? provider.defaultModel,
    messages: [
      { role: 'system', content: opts.system },
      ...(opts.history ?? []),
      { role: 'user', content: opts.user },
    ] satisfies LLMChatMessage[],
    temperature: opts.temperature ?? 0.3,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  }

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.key}`,
      ...(provider.id === 'openrouter'
        ? {
            'HTTP-Referer':
              typeof window !== 'undefined' ? window.location.origin : 'https://ohana.app',
            'X-Title': 'Ohana · 欧哈娜',
          }
        : {}),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${provider.displayName} ${res.status}: ${text || res.statusText}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error(`${provider.displayName} returned no content`)
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
