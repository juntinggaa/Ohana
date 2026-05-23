import { useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { FamilyChatInput } from '@/components/FamilyChatInput'
import { MemberPill } from '@/components/MemberPill'
import type { CapturedTask } from '@/lib/agents/taskCaptureAgent'
import { cn } from '@/lib/utils'

const CATEGORY_LABEL: Record<string, string> = {
  elderly_care: '老人照护',
  medical: '医疗复诊',
  child_school: '孩子学校',
  household_admin: '家务行政',
  reimbursement: '票据报销',
  general_family: '家事',
}

export function InboxPage() {
  const [captured, setCaptured] = useState<CapturedTask[]>([])
  const [mode, setMode] = useState<'mock' | 'remote' | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="收件箱 · Task Capture"
        title="把混乱粘进来。"
        kicker="家庭群、医院、学校、物业 —— 全部丢进来，AI 替你立成任务。"
      />

      <div className="max-w-6xl mx-auto px-8 lg:px-12 pb-20 grid lg:grid-cols-2 gap-12">
        <div>
          <FamilyChatInput
            onCaptured={(tasks, m) => {
              setCaptured(tasks)
              setMode(m)
            }}
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <div className="eyebrow">
              {captured.length > 0 ? `AI 识别 · ${captured.length} 条` : 'AI 识别结果'}
            </div>
            {mode && (
              <span className="text-tiny text-ink-500 italic">
                {mode === 'remote' ? '远程 LLM' : '本地确定性逻辑'}
              </span>
            )}
          </div>

          {captured.length === 0 && (
            <div className="border-t border-ink-200 pt-10 pb-16 text-center">
              <p className="font-serif text-lead text-ink-500 italic max-w-sm mx-auto">
                点左边的「AI 识别任务」，看混乱怎么变成结构。
              </p>
            </div>
          )}

          <ul className="space-y-0 border-t border-ink-200">
            {captured.map((c, idx) => (
              <li
                key={c.id}
                className={cn(
                  'border-b border-ink-200 py-5 animate-fade-up',
                )}
                style={{ animationDelay: `${idx * 70}ms` }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="eyebrow">{CATEGORY_LABEL[c.category] ?? c.category}</div>
                  <span className="text-tiny text-ink-400 italic">
                    置信度 {(c.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <h3 className="font-serif text-h3 text-ink-900 leading-tight mt-1.5">
                  {c.title}
                </h3>
                <p className="text-small text-ink-500 italic mt-2 leading-relaxed">
                  {c.matchedLine}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-tiny">
                  <span className="text-ink-400">建议</span>
                  <MemberPill id={c.suggestedOwnerId} size="xs" />
                  <span className="text-ink-500">· {c.suggestionReason}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
