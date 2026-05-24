import { useRef, useState, type DragEvent } from 'react'
import { Upload, FileImage, FileText, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { classifyFile, runMistralOcr, hasMistralKey } from '@/lib/ocr/mistralOcr'

interface Props {
  onMarkdown: (markdown: string, filename: string, pages: number) => void
  onError: (message: string) => void
  className?: string
}

const ACCEPT = 'image/*,application/pdf'

export function FileUploader({ onMarkdown, onError, className }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<{ name: string; pages: number } | null>(null)

  async function handleFile(file: File) {
    if (busy) return
    if (!hasMistralKey()) {
      onError('OCR 未配置 (.env 缺 VITE_OCR_SPACE_API_KEY)')
      return
    }
    const kind = classifyFile(file)
    if (kind === 'unknown') {
      onError(`不支持的文件类型：${file.type || file.name}`)
      return
    }
    setBusy(true)
    try {
      const res = await runMistralOcr(file)
      setRecent({ name: res.filename, pages: res.pages })
      onMarkdown(res.markdown, res.filename, res.pages)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      onError(msg)
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setHover(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  return (
    <div
      className={cn(
        'border border-dashed border-ink-300 bg-paper-50 transition cursor-pointer relative',
        hover && 'border-rouge-500 bg-rouge-50',
        busy && 'cursor-wait',
        className,
      )}
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!busy) setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />

      <div className="px-6 py-10 text-center">
        {busy ? (
          <>
            <Loader2 size={28} className="mx-auto text-rouge-500 animate-spin" />
            <div className="mt-3 text-small text-ink-700">Mistral OCR 识别中…</div>
            <div className="text-tiny text-ink-500 mt-1">通常 3-8 秒</div>
          </>
        ) : (
          <>
            <Upload size={24} className="mx-auto text-ink-400" />
            <div className="mt-3 text-small text-ink-700 font-medium">
              拖入图片或 PDF · 或点击选择
            </div>
            <div className="text-tiny text-ink-500 mt-1 leading-relaxed">
              处方照片 · 化验单 · 幼儿园通知 · 物业短信截图
              <br />
              支持 jpg / png / pdf · 单文件 ≤ 20 MB
            </div>
          </>
        )}
      </div>

      {recent && !busy && (
        <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 text-micro text-ink-500 bg-paper px-2 py-1 border border-ink-200">
          {recent.name.endsWith('.pdf') ? (
            <FileText size={10} />
          ) : (
            <FileImage size={10} />
          )}
          <span className="max-w-[120px] truncate">{recent.name}</span>
          <span>· {recent.pages}p</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setRecent(null)
            }}
            className="ml-1 text-ink-400 hover:text-ink-900"
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  )
}
