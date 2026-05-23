import { useMemo, useState } from 'react'
import { X, Copy, CheckCircle2, Send, Zap } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Avatar } from './Avatar'
import type { CareTask } from '@/lib/types'

interface Props {
  task: CareTask
  onClose: () => void
}

interface MessagePack {
  ownerId: string
  ownerName: string
  subtaskTitles: string[]
  message: string
}

function buildMessage(
  task: CareTask,
  ownerName: string,
  subtasks: string[],
  deadline: string,
): string {
  const lines = subtasks.map((t) => `  · ${t}`).join('\n')
  const place = task.locationName ? `\n地点：${task.locationName}` : ''
  const proof = task.requiredProof?.length
    ? `\n完成后请上传：${task.requiredProof.join(' / ')}`
    : ''
  return `${ownerName}，关于「${task.title}」，需要你做的事：
${lines}
截止：${deadline}${place}${proof}

确认请回复"我来"或在 App 里点接受。`
}

export function AssignAllModal({ task, onClose }: Props) {
  const members = useAppStore((s) => s.familyMembers)
  const pushToast = useAppStore((s) => s.pushToast)
  const pushNotification = useAppStore((s) => s.pushNotification)
  const markAssignmentsSent = useAppStore((s) => s.markAssignmentsSent)
  const [copied, setCopied] = useState<string | null>(null)
  const [simulatedSent, setSimulatedSent] = useState(false)

  const packs: MessagePack[] = useMemo(() => {
    const byOwner = new Map<string, string[]>()
    task.subtasks.forEach((sub) => {
      if (!sub.ownerId) return
      const list = byOwner.get(sub.ownerId) ?? []
      list.push(sub.title)
      byOwner.set(sub.ownerId, list)
    })
    const result: MessagePack[] = []
    byOwner.forEach((subtaskTitles, ownerId) => {
      const member = members.find((m) => m.id === ownerId)
      if (!member) return
      result.push({
        ownerId,
        ownerName: member.name,
        subtaskTitles,
        message: buildMessage(task, member.name, subtaskTitles, task.dueDateText ?? '本周内'),
      })
    })
    return result
  }, [task, members])

  async function handleCopy(pack: MessagePack) {
    try {
      await navigator.clipboard.writeText(pack.message)
      setCopied(pack.ownerId)
      pushToast(`已复制给 ${pack.ownerName} 的消息`, 'success')
      setTimeout(() => setCopied((c) => (c === pack.ownerId ? null : c)), 2000)
    } catch {
      pushToast('复制失败 · 请手动选择文字', 'warn')
    }
  }

  async function handleCopyAll() {
    const all = packs
      .map((p) => `═══ 给 ${p.ownerName} ═══\n${p.message}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(all)
      pushToast(`已复制全部 ${packs.length} 份消息`, 'success')
    } catch {
      pushToast('复制失败', 'warn')
    }
  }

  function handleSimulateSend() {
    markAssignmentsSent(task.id)
    // 模拟：往每个被指派的人发一条 assignment 通知
    packs.forEach((p) => {
      pushNotification({
        recipientId: p.ownerId,
        kind: 'assignment',
        message: `「${task.title}」已指给你 · ${p.subtaskTitles.length} 件事 · 截止 ${task.dueDateText ?? '本周内'}`,
        taskId: task.id,
      })
    })
    setSimulatedSent(true)
    pushToast(`已模拟发送给 ${packs.length} 位家人`, 'success')
  }

  function handleMarkSent() {
    markAssignmentsSent(task.id)
    pushToast('已标记为已发送 · 后续回复会进收件箱', 'success')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-stretch md:items-center md:justify-center p-0 md:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-2xl bg-paper shadow-modal max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-ink-200 px-8 py-5 flex items-start justify-between gap-4 z-10">
          <div>
            <div className="eyebrow">确认指派 · 生成通知</div>
            <h2 className="font-serif text-h2 text-ink-900 mt-2 leading-tight">
              {packs.length} 份个性化消息已准备好
            </h2>
            <p className="text-small text-ink-500 mt-2 max-w-md">
              每个人只看到 ta 自己那部分。先确认 / 复制 / 模拟发送，再标记已发出。
            </p>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 p-1" aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-4">
          {packs.length === 0 && (
            <div className="text-center py-10 text-small text-ink-500">
              当前任务没有任何子任务分配出去。先在「行动清单」里给子任务指派负责人。
            </div>
          )}

          {packs.map((p) => {
            const member = members.find((m) => m.id === p.ownerId)
            return (
              <div key={p.ownerId} className="border border-ink-200 bg-paper-50">
                <div className="px-4 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {member && <Avatar member={member} size={22} />}
                    <div className="text-small font-medium text-ink-900">
                      给 {p.ownerName}
                      <span className="ml-2 text-tiny text-ink-500 font-normal">
                        {p.subtaskTitles.length} 件事
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(p)}
                    className={
                      copied === p.ownerId
                        ? 'btn bg-moss-500 text-paper text-tiny'
                        : 'btn-outline text-tiny'
                    }
                  >
                    {copied === p.ownerId ? (
                      <>
                        <CheckCircle2 size={12} />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        复制给 {p.ownerName}
                      </>
                    )}
                  </button>
                </div>
                <pre className="px-4 py-3 text-small text-ink-700 font-mono whitespace-pre-wrap leading-relaxed">
                  {p.message}
                </pre>
              </div>
            )
          })}
        </div>

        {packs.length > 0 && (
          <div className="border-t border-ink-200 px-8 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={handleCopyAll} className="btn-outline text-tiny">
                <Copy size={12} />
                复制全部消息
              </button>
              <button
                onClick={handleSimulateSend}
                className={
                  simulatedSent
                    ? 'btn bg-moss-500 text-paper text-tiny'
                    : 'btn-outline text-tiny'
                }
              >
                {simulatedSent ? (
                  <>
                    <CheckCircle2 size={12} />
                    已模拟发送
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    模拟发送
                  </>
                )}
              </button>
              <button
                disabled
                title="待集成 WhatsApp / WeChat / Telegram"
                className="btn text-tiny border border-ink-200 text-ink-400 cursor-not-allowed inline-flex items-center gap-1.5"
              >
                <Zap size={12} />
                自动发送（待集成）
              </button>
            </div>
            <button onClick={handleMarkSent} className="btn-rouge text-tiny">
              <CheckCircle2 size={12} />
              确认并标记已发送
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
