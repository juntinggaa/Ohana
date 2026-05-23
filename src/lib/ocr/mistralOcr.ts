/**
 * Mistral OCR · 把图片 / PDF 转成 markdown 文本
 *
 * API 文档：https://docs.mistral.ai/capabilities/OCR/
 *
 * 用法：
 *   const md = await runMistralOcr(file)
 *   // 然后把 md 喂给 taskCaptureAgent.analyzeFamilyMessages()
 *
 * ⚠️ 当前实现把 API Key 暴露在前端。生产请走后端代理。
 */

const env = (import.meta as { env?: Record<string, string> }).env ?? {}
const MISTRAL_KEY = env.VITE_MISTRAL_API_KEY ?? ''
const MISTRAL_BASE = 'https://api.mistral.ai/v1'

export function hasMistralKey(): boolean {
  return Boolean(MISTRAL_KEY)
}

/** 文件 → base64 data URL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

export type OcrFileKind = 'image' | 'pdf' | 'unknown'

export function classifyFile(file: File): OcrFileKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf') return 'pdf'
  return 'unknown'
}

/** 单页 OCR 结果（Mistral 返回结构） */
interface MistralOcrPage {
  index: number
  markdown: string
  images?: unknown[]
  dimensions?: { width: number; height: number }
}

interface MistralOcrResponse {
  pages?: MistralOcrPage[]
  model?: string
  usage_info?: { pages_processed: number; doc_size_bytes?: number }
}

export interface OcrResult {
  /** 拼接后的 markdown */
  markdown: string
  /** 处理的页数 */
  pages: number
  /** 来源文件名 */
  filename: string
}

/**
 * 调 Mistral OCR。
 *
 * @throws 如果没 key、文件类型不支持、或 API 返回错误
 */
export async function runMistralOcr(file: File): Promise<OcrResult> {
  if (!MISTRAL_KEY) {
    throw new Error('No Mistral API key. 请在 .env 填入 VITE_MISTRAL_API_KEY')
  }
  const kind = classifyFile(file)
  if (kind === 'unknown') {
    throw new Error(`不支持的文件类型：${file.type || '未知'}`)
  }

  const dataUrl = await fileToDataUrl(file)

  // Mistral OCR 的 document 字段：
  // - 图片用 image_url + image_url 字段（字符串）
  // - PDF 用 document_url + document_url 字段
  const body =
    kind === 'image'
      ? {
          model: 'mistral-ocr-latest',
          document: { type: 'image_url', image_url: dataUrl },
        }
      : {
          model: 'mistral-ocr-latest',
          document: { type: 'document_url', document_url: dataUrl },
        }

  const res = await fetch(`${MISTRAL_BASE}/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mistral OCR ${res.status}: ${text || res.statusText}`)
  }

  const data = (await res.json()) as MistralOcrResponse
  const pages = data.pages ?? []
  if (pages.length === 0) {
    throw new Error('Mistral OCR 返回 0 页内容')
  }

  const markdown = pages
    .map((p, i) => {
      const header = pages.length > 1 ? `\n### 第 ${i + 1} 页\n\n` : ''
      return header + (p.markdown ?? '')
    })
    .join('\n\n')
    .trim()

  return {
    markdown,
    pages: pages.length,
    filename: file.name,
  }
}
