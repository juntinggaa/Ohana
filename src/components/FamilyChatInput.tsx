import { useEffect, useState } from 'react'
import { Loader2, Sparkles, FileText } from 'lucide-react'
import { FAMILY_CHAT_RAW } from '@/lib/mockData'
import { analyzeFamilyMessages, type CapturedTask } from '@/lib/agents/taskCaptureAgent'
import { FileUploader } from './FileUploader'
import { hasMistralKey } from '@/lib/ocr/mistralOcr'
import { useAppStore } from '@/lib/store'

interface Props {
  onCaptured: (tasks: CapturedTask[], mode: 'mock' | 'remote', remoteError?: string) => void
}

type InputMode = 'paste' | 'upload'

export function FamilyChatInput({ onCaptured }: Props) {
  const members = useAppStore((s) => s.familyMembers)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const isSampleFamily = members.some((m) => m.id === 'tangning')
  const [mode, setMode] = useState<InputMode>('paste')
  const [value, setValue] = useState(() => (isSampleFamily ? FAMILY_CHAT_RAW : ''))
  const [loading, setLoading] = useState(false)
  const [ocrInfo, setOcrInfo] = useState<{ filename: string; pages: number } | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSampleFamily && value === FAMILY_CHAT_RAW) setValue('')
  }, [isSampleFamily, value])

  async function run() {
    setLoading(true)
    try {
      const res = await analyzeFamilyMessages(value, { members, currentUserId })
      onCaptured(res.data, res.mode, res.remoteError)
    } finally {
      setLoading(false)
    }
  }

  function handleOcrMarkdown(md: string, filename: string, pages: number) {
    setValue(md)
    setOcrInfo({ filename, pages })
    setOcrError(null)
    // 自动切回 paste 视图，让用户看到识别出来的文字
    setMode('paste')
  }

  const lineCount = value.split('\n').filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* 模式切换 */}
      <div className="flex items-center justify-between gap-4">
        <div className="segmented">
          <button
            className={
              mode === 'paste'
                ? 'segment segment-active'
                : 'segment'
            }
            onClick={() => setMode('paste')}
            disabled={loading}
          >
            粘贴消息
          </button>
          <button
            className={
              mode === 'upload'
                ? 'segment segment-active'
                : 'segment'
            }
            onClick={() => setMode('upload')}
            disabled={loading}
          >
            图片 / PDF
          </button>
        </div>
        {mode === 'paste' && isSampleFamily && (
          <button
            className="text-tiny text-ink-500 hover:text-ink-900 underline underline-offset-4"
            onClick={() => {
              setValue(FAMILY_CHAT_RAW)
              setOcrInfo(null)
            }}
            disabled={loading}
          >
            换回示例消息
          </button>
        )}
      </div>

      {/* 上传 */}
      {mode === 'upload' && (
        <>
          <FileUploader onMarkdown={handleOcrMarkdown} onError={setOcrError} />
          {!hasMistralKey() && (
            <div className="text-tiny text-ink-500 border-l-2 border-ink-300 pl-3 py-1">
              图片识别还未开启。需要时可在设置中配置 OCR。
            </div>
          )}
          {ocrError && (
            <div className="text-tiny text-rouge-700 border-l-2 border-rouge-500 pl-3 py-1 break-all">
              {ocrError}
            </div>
          )}
        </>
      )}

      {/* 文字编辑（OCR 后也会回到这里） */}
      {mode === 'paste' && (
        <>
          {ocrInfo && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-moss-50 border-l-2 border-moss-500 text-tiny">
              <span className="inline-flex items-center gap-2 text-moss-600">
                <FileText size={11} />
                Mistral OCR 已识别 ·
                <span className="font-mono text-ink-700">{ocrInfo.filename}</span>
                <span className="text-ink-500">· {ocrInfo.pages} 页</span>
              </span>
              <button
                className="text-ink-500 hover:text-ink-900 underline underline-offset-4"
                onClick={() => setOcrInfo(null)}
              >
                忽略
              </button>
            </div>
          )}
          <textarea
            className="w-full h-72 bg-paper border border-paper-200 p-5
                       font-mono text-small leading-relaxed text-ink-800
                       focus:outline-none focus:border-rouge-300 transition resize-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="把家庭群、医院提醒或学校通知带进来&#10;&#10;每行一句即可。欧哈娜会看看有没有需要家人一起关心的事。"
            disabled={loading}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="text-tiny text-ink-500">
              {loading
                ? '正在轻轻整理…'
                : `${lineCount} 条消息 · 预计 1-2 秒`}
            </div>
            <button
              className="btn-rouge"
              onClick={run}
              disabled={loading || !value.trim()}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {loading ? '整理中' : '帮我看看'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
