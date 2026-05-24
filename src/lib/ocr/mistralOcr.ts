/**
 * OCR client · 当前 provider · OCR.space
 *
 * API: https://ocr.space/OCRAPI
 *
 * 用法：
 *   const md = await runMistralOcr(file)  // 函数名保留是为了让既有调用点不用改
 *   // 然后把 md 喂给 taskCaptureAgent.analyzeFamilyMessages()
 *
 * Env vars (按优先级)：
 *   - VITE_OCR_SPACE_API_KEY  · 推荐
 *   - VITE_MISTRAL_API_KEY    · 老 key 名 · 兼容用
 *
 * ⚠️ 当前实现把 API Key 暴露在前端。生产请走后端代理。
 *
 * 限制（免费档）：
 *   - 文件 ≤ 1 MB
 *   - 每月 25,000 次
 *   - PDF 仅支持付费档；图片支持 jpg / png / gif / pdf 等
 */

const env = (import.meta as { env?: Record<string, string> }).env ?? {}
const OCR_KEY = env.VITE_OCR_SPACE_API_KEY ?? env.VITE_MISTRAL_API_KEY ?? ''
const OCR_ENDPOINT = 'https://api.ocr.space/parse/image'
/** OCR.space 语言代码 · chs = 简体中文 */
const DEFAULT_LANG = 'chs'

/** 保留旧名，外部调用点不用改 */
export function hasMistralKey(): boolean {
  return Boolean(OCR_KEY)
}

export type OcrFileKind = 'image' | 'pdf' | 'unknown'

export function classifyFile(file: File): OcrFileKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  return 'unknown'
}

/** OCR.space 单页解析结果（响应结构） */
interface OcrSpacePage {
  ParsedText?: string
  FileParseExitCode?: number
  ErrorMessage?: string
  ErrorDetails?: string
}

interface OcrSpaceResponse {
  ParsedResults?: OcrSpacePage[]
  OCRExitCode?: number
  IsErroredOnProcessing?: boolean
  ErrorMessage?: string | string[]
  ErrorDetails?: string
  ProcessingTimeInMilliseconds?: string
}

export interface OcrResult {
  /** 拼接后的 markdown（OCR.space 返回纯文本，我们按段落分页拼） */
  markdown: string
  /** 处理的页数 */
  pages: number
  /** 来源文件名 */
  filename: string
}

/**
 * 调 OCR.space。
 *
 * @throws 如果没 key、文件类型不支持、或 API 返回错误
 */
export async function runMistralOcr(file: File): Promise<OcrResult> {
  if (!OCR_KEY) {
    throw new Error('No OCR API key. 请在 .env 填入 VITE_OCR_SPACE_API_KEY')
  }
  const kind = classifyFile(file)
  if (kind === 'unknown') {
    throw new Error(`不支持的文件类型：${file.type || '未知'}`)
  }

  // 免费档限制 1 MB，提前 friendly fail
  if (file.size > 1024 * 1024) {
    throw new Error(
      `OCR.space 免费档单文件需 ≤ 1 MB，当前 ${(file.size / 1024 / 1024).toFixed(2)} MB`,
    )
  }

  const form = new FormData()
  form.append('apikey', OCR_KEY)
  form.append('language', DEFAULT_LANG)
  // engine 2 对非拉丁字符（中文）更稳
  form.append('OCREngine', '2')
  form.append('isOverlayRequired', 'false')
  form.append('scale', 'true')
  form.append('detectOrientation', 'true')
  form.append('file', file, file.name)

  const res = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OCR.space ${res.status}: ${text || res.statusText}`)
  }

  const data = (await res.json()) as OcrSpaceResponse

  if (data.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(' · ')
      : (data.ErrorMessage ?? 'OCR.space 处理出错')
    throw new Error(`OCR.space 错误：${msg}`)
  }

  const pages = data.ParsedResults ?? []
  if (pages.length === 0) {
    throw new Error('OCR.space 返回 0 页内容')
  }

  const markdown = pages
    .map((p, i) => {
      const header = pages.length > 1 ? `\n### 第 ${i + 1} 页\n\n` : ''
      const text = (p.ParsedText ?? '').trim()
      return header + text
    })
    .join('\n\n')
    .trim()

  if (!markdown) {
    throw new Error('OCR.space 识别出空文本 · 试试更清晰的图片')
  }

  return {
    markdown,
    pages: pages.length,
    filename: file.name,
  }
}
