import { useState } from 'react'
import { Send, Copy } from 'lucide-react'
import type { CareTask, ResponsibilityRisk } from '@/lib/types'
import { MemberPill } from './MemberPill'
import { useAppStore } from '@/lib/store'

interface Props {
  risks: ResponsibilityRisk[]
  tasks: CareTask[]
  initialVisible?: number
}

const TYPE_LABEL: Record<ResponsibilityRisk['type'], string> = {
  vague_acknowledgement: '需要再确认一句',
  missing_deadline: '还没有时间',
  missing_proof: '还没有完成证明',
  fallback_to_originator: '又回到同一个人',
  overloaded_originator: '同一个人最近比较辛苦',
}

export function ResponsibilityTransferPanel({
  risks,
  tasks,
  initialVisible = 2,
}: Props) {
  const [showAll, setShowAll] = useState(false)
  const pushToast = useAppStore((s) => s.pushToast)

  const visible = showAll ? risks : risks.slice(0, initialVisible)
  const hidden = risks.length - visible.length

  async function handleCopy(risk: ResponsibilityRisk) {
    const task = tasks.find((t) => t.id === risk.taskId)
    const text = task
      ? `【关于 ${task.title}】\n${risk.suggestedPrompt}`
      : risk.suggestedPrompt
    try {
      await navigator.clipboard.writeText(text)
      pushToast('已复制，可以粘贴到家庭群', 'success')
    } catch {
      pushToast('复制失败，请手动选择文字', 'warn')
    }
  }

  if (risks.length === 0) {
    return (
      <div className="border-t border-ink-200 pt-10 text-center">
        <p className="text-small text-ink-500 max-w-md mx-auto">
          现在没有悬在心里的事，家里的牵挂都有了回应。
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-h2 text-ink-900 leading-tight">
          {risks.length} 件事可以再问候一下
        </h2>
        <p className="mt-2 text-small text-ink-500 max-w-xl">
          不是催谁，只是轻轻确认一句，让惦记的人能够放心。
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
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <button className="btn-rouge" onClick={() => handleCopy(r)}>
                    <Send size={12} />
                    复制到家庭群
                  </button>
                  <button className="btn-ghost" onClick={() => handleCopy(r)}>
                    <Copy size={12} />
                    只复制文字
                  </button>
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
