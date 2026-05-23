import { useState } from 'react'
import { Send } from 'lucide-react'
import type { CareTask, ResponsibilityRisk } from '@/lib/types'
import { MemberPill } from './MemberPill'

interface Props {
  risks: ResponsibilityRisk[]
  tasks: CareTask[]
  onSendPrompt?: (risk: ResponsibilityRisk) => void
  /** 默认显示几条，剩下的折叠 */
  initialVisible?: number
}

const TYPE_LABEL: Record<ResponsibilityRisk['type'], string> = {
  vague_acknowledgement: '"收到"不等于责任',
  missing_deadline: '缺截止时间',
  missing_proof: '缺完成证明',
  fallback_to_originator: '任务在悄悄掉回',
  overloaded_originator: '发起人已超载',
}

export function ResponsibilityTransferPanel({
  risks,
  tasks,
  onSendPrompt,
  initialVisible = 2,
}: Props) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? risks : risks.slice(0, initialVisible)
  const hidden = risks.length - visible.length

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-2">责任交接 · 系统替你写好的追问</div>
        <h2 className="font-serif text-h2 text-ink-900 leading-tight">
          {risks.length} 句话，发出去就行。
        </h2>
        <p className="mt-3 text-body text-ink-600 max-w-xl">
          不是责怪谁。只是把"截止时间 + 证明"两项缺失补上，让任务真的落下来。
        </p>
      </div>

      <ul className="space-y-0 border-t border-ink-200">
        {visible.map((r) => {
          const task = tasks.find((t) => t.id === r.taskId)
          return (
            <li
              key={r.id}
              className="border-b border-ink-200 py-6 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 md:gap-8"
            >
              <div>
                <div className="eyebrow text-rouge-500">{TYPE_LABEL[r.type]}</div>
                {r.personId && (
                  <div className="mt-3">
                    <MemberPill id={r.personId} size="sm" />
                  </div>
                )}
                {task && (
                  <div className="text-tiny text-ink-500 mt-3 leading-snug">
                    关联：{task.title}
                  </div>
                )}
              </div>
              <div>
                <div className="text-body text-ink-700 mb-4 leading-relaxed">{r.message}</div>
                <blockquote className="font-serif text-lead text-ink-900 italic border-l-2 border-rouge-500 pl-4">
                  {r.suggestedPrompt}
                </blockquote>
                <div className="mt-4 flex items-center gap-2">
                  <button className="btn-primary" onClick={() => onSendPrompt?.(r)}>
                    <Send size={12} />
                    发到家庭群
                  </button>
                  <button className="btn-ghost">改一下措辞</button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {hidden > 0 && (
        <button
          className="text-small text-ink-700 underline underline-offset-4 hover:text-rouge-500"
          onClick={() => setShowAll(true)}
        >
          再看 {hidden} 条 →
        </button>
      )}
    </div>
  )
}
