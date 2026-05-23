import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { FAMILY_CHAT_RAW } from '@/lib/mockData'
import { analyzeFamilyMessages, type CapturedTask } from '@/lib/agents/taskCaptureAgent'

interface Props {
  onCaptured: (tasks: CapturedTask[], mode: 'mock' | 'remote') => void
}

export function FamilyChatInput({ onCaptured }: Props) {
  const [value, setValue] = useState(FAMILY_CHAT_RAW)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 700))
    const res = await analyzeFamilyMessages(value)
    onCaptured(res.data, res.mode)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="eyebrow">混乱的原始消息</div>
        <button
          className="text-tiny text-ink-500 hover:text-ink-900 underline underline-offset-4"
          onClick={() => setValue(FAMILY_CHAT_RAW)}
          disabled={loading}
        >
          换回示例
        </button>
      </div>
      <textarea
        className="w-full h-72 bg-paper-50 border border-ink-200 p-5
                   font-mono text-small leading-relaxed text-ink-800
                   focus:outline-none focus:border-ink-700"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="把家庭群、医院通知、学校群、物业短信粘进来"
      />
      <div className="flex items-center justify-between">
        <div className="text-tiny text-ink-500 italic">
          {loading ? '识别中…' : `准备识别 · 约 ${value.split('\n').filter(Boolean).length} 条消息`}
        </div>
        <button className="btn-rouge" onClick={run} disabled={loading}>
          {loading && <Loader2 size={12} className="animate-spin" />}
          AI 识别任务
        </button>
      </div>
    </div>
  )
}
