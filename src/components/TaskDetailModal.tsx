import { X, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CareTask, SubTask } from '@/lib/types'
import { MemberPill } from './MemberPill'
import { Avatar } from './Avatar'
import { getMember, RAW_MESSAGES } from '@/lib/mockData'
import { cn } from '@/lib/utils'

interface Props {
  task: CareTask | null
  onClose: () => void
  onAccept?: (taskId: string, ownerId: string, deadline: string) => void
}

const PHASE_LABEL: Record<SubTask['phase'], string> = {
  before: '前一晚 / 准备',
  during: '当天 / 现场',
  after: '事后 / 跟进',
  general: '其他',
}

export function TaskDetailModal({ task, onClose, onAccept }: Props) {
  const [acceptedOwner, setAcceptedOwner] = useState<string | undefined>(undefined)

  useEffect(() => {
    setAcceptedOwner(undefined)
  }, [task?.id])

  if (!task) return null

  const sourceMessages = RAW_MESSAGES.filter((m) => task.sourceMessageIds.includes(m.id))
  const grouped: Record<SubTask['phase'], SubTask[]> = {
    before: [],
    during: [],
    after: [],
    general: [],
  }
  task.subtasks.forEach((s) => grouped[s.phase].push(s))

  return (
    <div
      className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm flex items-stretch md:items-center md:justify-center p-0 md:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-3xl bg-paper shadow-modal max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-ink-200 px-8 py-5 flex items-start justify-between gap-4 z-10">
          <div>
            <div className="eyebrow">任务详情</div>
            <h2 className="font-serif text-h2 text-ink-900 mt-2 leading-tight">{task.title}</h2>
            {task.dueDateText && (
              <div className="text-small text-ink-500 italic mt-1.5">{task.dueDateText}</div>
            )}
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 p-1" aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-8 space-y-10">
          {sourceMessages.length > 0 && (
            <section>
              <div className="eyebrow mb-4">原始消息</div>
              <div className="space-y-3">
                {sourceMessages.map((m) => {
                  const member = getMember(m.speakerId)
                  return (
                    <div key={m.id} className="flex items-start gap-3 pb-3 border-b border-ink-100">
                      {member ? (
                        <Avatar member={member} size={24} />
                      ) : (
                        <div className="w-6 h-6 bg-ink-200 text-ink-700 grid place-items-center text-tiny font-serif" style={{ borderRadius: 2 }}>
                          系
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-micro text-ink-500">
                          {m.channel} · {m.speakerLabel} · {m.timestamp}
                        </div>
                        <div className="text-body text-ink-800 mt-1">{m.body}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {task.aiExplanation && (
            <section className="border-l-2 border-rouge-500 pl-5">
              <div className="eyebrow mb-2 text-rouge-500">AI 解读</div>
              <p className="font-serif text-lead text-ink-900 italic leading-relaxed">
                {task.aiExplanation}
              </p>
              {task.suggestionReason && (
                <div className="mt-4 text-small text-ink-600 flex items-start gap-2">
                  <span className="text-ink-400">推荐</span>
                  <MemberPill id={task.suggestedOwnerId} />
                  <span className="text-ink-400">·</span>
                  <span>{task.suggestionReason}</span>
                </div>
              )}
            </section>
          )}

          <section>
            <div className="eyebrow mb-5">行动清单</div>
            <div className="space-y-6">
              {(['before', 'during', 'after', 'general'] as const).map((phase) => {
                const items = grouped[phase]
                if (items.length === 0) return null
                return (
                  <div key={phase}>
                    <div className="text-tiny text-ink-500 mb-2 italic font-serif">
                      {PHASE_LABEL[phase]}
                    </div>
                    <ul className="space-y-2">
                      {items.map((s) => (
                        <li key={s.id} className="flex items-start gap-3 text-body">
                          <span
                            className={cn(
                              'mt-1.5 w-3 h-3 border shrink-0',
                              s.completed
                                ? 'bg-moss-500 border-moss-500'
                                : 'border-ink-300 bg-paper',
                            )}
                          />
                          <span
                            className={cn(
                              'flex-1',
                              s.completed && 'line-through text-ink-400',
                            )}
                          >
                            {s.title}
                          </span>
                          {s.ownerId && <MemberPill id={s.ownerId} size="xs" />}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </section>

          {task.requiredProof && task.requiredProof.length > 0 && (
            <section>
              <div className="eyebrow mb-3">完成证明</div>
              <div className="text-body text-ink-700">
                {task.requiredProof.join(' · ')}
              </div>
            </section>
          )}

          {task.riskNotes && task.riskNotes.length > 0 && (
            <section>
              <div className="eyebrow mb-3 text-rouge-500">如果不接住</div>
              <ul className="space-y-1.5 text-body text-ink-700">
                {task.riskNotes.map((r) => (
                  <li key={r} className="flex items-start gap-3">
                    <span className="text-rouge-500 mt-2 w-2 h-px bg-rouge-500" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="border-t border-ink-200 pt-8">
            <div className="eyebrow mb-3">让责任真正落下</div>
            <p className="font-serif text-lead text-ink-700 italic mb-5 max-w-xl">
              选一个执行人。系统会把"截止 + 证明"一起发到家庭群。
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {['bro', 'zhou', 'mom', 'tangning'].map((id) => {
                const m = getMember(id)
                if (!m) return null
                return (
                  <button
                    key={id}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 border text-small transition',
                      acceptedOwner === id
                        ? 'border-rouge-500 bg-rouge-50 text-rouge-700'
                        : 'border-ink-300 text-ink-700 hover:border-ink-700',
                    )}
                    onClick={() => setAcceptedOwner(id)}
                  >
                    <Avatar member={m} size={18} />
                    {m.name}
                    {id === task.suggestedOwnerId && (
                      <span className="text-micro text-ink-500 italic">推荐</span>
                    )}
                  </button>
                )
              })}
            </div>
            {acceptedOwner && (
              <button
                className="btn-rouge"
                onClick={() => {
                  onAccept?.(task.id, acceptedOwner, task.dueDateText ?? '本周内')
                  onClose()
                }}
              >
                <Send size={12} />
                把承接卡片发到家庭群
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
