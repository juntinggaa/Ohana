import {
  X, Send, Check, Copy, Trash2, Wand2, Clock,
  Camera, MapPin, CalendarPlus, MessageSquareShare,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CareTask, SubTask } from '@/lib/types'
import { MemberPill } from './MemberPill'
import { Avatar } from './Avatar'
import { OwnerPicker } from './OwnerPicker'
import { OriginatorLabel } from './OriginatorLabel'
import { AssignAllModal } from './AssignAllModal'
import { RAW_MESSAGES } from '@/lib/mockData'
import { useAppStore } from '@/lib/store'
import { useIsSimpleMode } from '@/lib/useUiMode'
import {
  isTaskAcceptedByUser,
  isTaskAssignedToUser,
  statusVisualForTask,
  taskAssigneeIds,
} from '@/lib/status'
import { cn, formatDueDate } from '@/lib/utils'

interface Props {
  task: CareTask | null
  onClose: () => void
}

const PHASE_LABEL: Record<SubTask['phase'], string> = {
  before: '前一晚 / 准备',
  during: '当天 / 现场',
  after: '事后 / 跟进',
  general: '其他',
}

const PHASE_LABEL_SIMPLE: Record<SubTask['phase'], string> = {
  before: '准备',
  during: '当天要做',
  after: '完成后',
  general: '其他',
}

const REJECT_REASONS = [
  '今天不在城市里',
  '最近确实没有余力',
  '身体不舒服',
  '已经做过 / 没必要',
  '别人更合适',
]

export function TaskDetailModal({ task, onClose }: Props) {
  const currentUserId = useAppStore((s) => s.currentUserId)
  const members = useAppStore((s) => s.familyMembers)
  const acceptResponsibility = useAppStore((s) => s.acceptResponsibility)
  const toggleSubtask = useAppStore((s) => s.toggleSubtask)
  const setSubtaskOwner = useAppStore((s) => s.setSubtaskOwner)
  const assignAllRecommended = useAppStore((s) => s.assignAllRecommended)
  const markTaskCompleted = useAppStore((s) => s.markTaskCompleted)
  const removeTask = useAppStore((s) => s.removeTask)
  const respondToTask = useAppStore((s) => s.respondToTask)
  const pushToast = useAppStore((s) => s.pushToast)
  const addAttachment = useAppStore((s) => s.addAttachment)

  const isSimple = useIsSimpleMode()

  const [acceptedOwner, setAcceptedOwner] = useState<string | undefined>(undefined)
  const [editedDeadline, setEditedDeadline] = useState<string>('')
  const [showAssignAll, setShowAssignAll] = useState(false)
  const [showRejectPicker, setShowRejectPicker] = useState(false)
  const [rejectReason, setRejectReason] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAcceptedOwner(task?.executorId ?? task?.suggestedOwnerId)
    setEditedDeadline(task?.dueDateText ?? '本周内')
    setShowRejectPicker(false)
    setRejectReason('')
  }, [task?.id])

  const sourceMessages = useMemo(
    () =>
      task
        ? RAW_MESSAGES.filter((m) => task.sourceMessageIds.includes(m.id))
        : [],
    [task],
  )

  const grouped: Record<SubTask['phase'], SubTask[]> = useMemo(() => {
    const g: Record<SubTask['phase'], SubTask[]> = {
      before: [],
      during: [],
      after: [],
      general: [],
    }
    task?.subtasks.forEach((s) => g[s.phase].push(s))
    return g
  }, [task])

  const assignedCount = useMemo(
    () => task?.subtasks.filter((s) => s.ownerId).length ?? 0,
    [task],
  )

  if (!task) return null

  // Per-current-user state
  // 真正被指派 · 有子任务或被设为 executor（不包括"只是被建议"）
  const isOwnerOfThis = isTaskAssignedToUser(task, currentUserId)
  const originatorExists = members.some((m) => m.id === task.originatorId)
  const isOriginator =
    task.originatorId === currentUserId ||
    task.originatorId === 'system' ||
    !originatorExists
  const subtasksForMe = task.subtasks.filter(
    (s) =>
      s.ownerId === currentUserId ||
      (!s.ownerId &&
        task.status === 'pending_acceptance' &&
        s.suggestedOwnerId === currentUserId),
  )
  const hasAccepted = isTaskAcceptedByUser(task, currentUserId)

  // 多人任务进度 · "已承接 X / Y 人"
  const allAssignees = taskAssigneeIds(task)
  const totalAssignees = allAssignees.length
  const acceptedCount =
    task.status === 'accepted' && (task.acceptedBy?.length ?? 0) === 0
      ? totalAssignees
      : allAssignees.filter((id) => task.acceptedBy?.includes(id)).length
  const isMultiPerson = totalAssignees > 1

  const statusV = statusVisualForTask(task, currentUserId)

  function handleAccept() {
    if (!acceptedOwner) return
    acceptResponsibility(task!.id, acceptedOwner, editedDeadline || '本周内')
    onClose()
  }

  async function handleCopyShare() {
    if (!acceptedOwner) {
      pushToast('先选一位方便问问的家人', 'warn')
      return
    }
    const owner = members.find((m) => m.id === acceptedOwner)
    const proof = task!.requiredProof?.length
      ? `\n完成证明：${task!.requiredProof.join(' / ')}`
      : ''
    const text = `【一起照看】
家中牵挂：${task!.title}
可以请：${owner?.name ?? acceptedOwner}
希望时间：${editedDeadline || '本周内'}${proof}

方便的话请回复"我来"，不方便也请告诉家人。`
    try {
      await navigator.clipboard.writeText(text)
      pushToast('温柔提醒已复制', 'success')
    } catch {
      pushToast('复制失败 · 请手动选择', 'warn')
    }
  }

  function handleAssignAll() {
    const result = assignAllRecommended(task!.id)
    const count = Object.keys(result).length
    if (count === 0) {
      pushToast('AI 暂无法推荐：先在「家庭」页给成员加几个 traits', 'warn')
      return
    }
    const names = Object.keys(result)
      .map((id) => members.find((m) => m.id === id)?.name ?? id)
      .join(' / ')
    pushToast(`先帮你选了可能方便的家人（${names}）· 发送前仍可调整`, 'success')
  }

  function handleConfirmAndNotify() {
    if (assignedCount === 0) {
      pushToast('还没有邀请家人一起照看', 'warn')
      return
    }
    setShowAssignAll(true)
  }

  function handleRespond(action: 'accepted' | 'rejected' | 'snoozed') {
    if (action === 'rejected') {
      respondToTask(task!.id, 'rejected', rejectReason || undefined)
      // 拒绝 · 关掉，让发起人去重派
      onClose()
    } else if (action === 'snoozed') {
      respondToTask(task!.id, action)
      onClose()
    } else {
      // 承接 · 不关 · 让用户看到状态变化
      respondToTask(task!.id, action)
      setShowRejectPicker(false)
      setRejectReason('')
    }
  }

  function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    addAttachment(task!.id, null, {
      type: 'image',
      url,
      fileName: file.name,
      uploadedById: currentUserId,
    })
    pushToast('照片已加入完成证明', 'success')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleCalendarExport() {
    // 简单 .ics 导出，本地下载
    if (!task) return
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Backstage Audit//CN\nBEGIN:VEVENT\nUID:${task.id}@backstage-audit\nSUMMARY:${task.title}\nDESCRIPTION:${(task.aiExplanation ?? task.sourceSummary).replace(/\n/g, ' ')}\n${task.locationName ? `LOCATION:${task.locationName}\n` : ''}END:VEVENT\nEND:VCALENDAR`
    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${task.title}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    pushToast('已下载 .ics · 双击导入日历', 'success')
  }

  function handleOpenMaps(provider: 'google' | 'apple') {
    if (!task?.locationName && !task?.locationAddress) return
    const q = encodeURIComponent(task.locationAddress ?? task.locationName ?? '')
    const url =
      provider === 'apple'
        ? `https://maps.apple.com/?q=${q}`
        : `https://www.google.com/maps/search/?api=1&query=${q}`
    window.open(url, '_blank', 'noopener')
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink-900/45 backdrop-blur-sm flex items-stretch md:items-center md:justify-center p-0 md:p-6 animate-fade-in"
        onClick={onClose}
      >
        <div
          className="w-full md:max-w-3xl bg-paper-50 border border-paper-200 rounded-none md:rounded-3xl shadow-modal max-h-[92vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-paper-50 border-b border-paper-200 px-8 py-5 flex items-start justify-between gap-4 z-10">
            <div className="min-w-0">
              <div className="eyebrow">{isSimple ? '家里在惦记' : '一起照看的事'}</div>
              <h2 className="font-serif text-h2 text-ink-900 mt-2 leading-tight">{task.title}</h2>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {(task.dueDate || task.dueDateText) && (
                  <div className={cn('text-small', statusV.textCls)}>
                    想在 {formatDueDate(task.dueDate) ?? task.dueDateText} 安心下来
                  </div>
                )}
                <span className={cn('text-tiny font-medium', statusV.textCls)}>
                  {isSimple ? statusV.simpleLabel : statusV.proLabel}
                </span>
              </div>
              {/* 来源 / 发起人 / 地点 */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-tiny">
                <span className="flex items-center gap-1.5 text-ink-500">
                  <span className="text-ink-400">最先惦记</span>
                  <OriginatorLabel
                    id={task.originatorId}
                    label={task.originatorLabel}
                    size="xs"
                  />
                </span>
                {task.locationName && (
                  <span className="flex items-center gap-1 text-ink-500">
                    <MapPin size={11} className="text-ink-400" />
                    {task.locationName}
                  </span>
                )}
                {(task.startDateTime || task.endDateTime) && (
                  <span className="flex items-center gap-1 text-ink-500">
                    <CalendarPlus size={11} className="text-ink-400" />
                    {task.startDateTime ?? task.endDateTime}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-ink-500 hover:text-ink-900 p-1 shrink-0" aria-label="关闭">
              <X size={20} />
            </button>
          </div>

          <div className="px-8 py-8 space-y-10">
            {/* "为我"提示 —— 当前身份被指派了这条任务 */}
            {isOwnerOfThis && task.status !== 'completed' && (
              hasAccepted ? (
                <section className="rounded-2xl border border-moss-100 bg-moss-50 px-5 py-4">
                  <div className="eyebrow text-moss-500 mb-1 inline-flex items-center gap-1.5">
                    <Check size={11} />
                    谢谢你，已经答应照看这一部分
                  </div>
                  {isMultiPerson && (
                    <div className="text-small text-ink-700 mb-2">
                      {acceptedCount} / {totalAssignees} 人确认 ·{' '}
                      {acceptedCount < totalAssignees
                        ? `还在等其他家人确认`
                        : '大家都有回应 · 这件事有人陪着了'}
                    </div>
                  )}
                  {subtasksForMe.length > 0 && (
                    <div className="text-small text-ink-700">
                      你的部分：
                      <ul className="mt-1.5 space-y-0.5">
                        {subtasksForMe.map((s) => (
                          <li key={s.id} className="text-ink-700">
                            · {s.title}
                            {s.completed && (
                              <span className="ml-2 text-tiny text-moss-500">✓ 已完成</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              ) : (
                <section className="rounded-2xl border border-rouge-100 bg-rouge-50 px-5 py-4">
                  <div className="eyebrow mb-1">家人想问你是否方便帮忙</div>
                  {isMultiPerson && (
                    <div className="text-tiny text-ink-500 mb-2">
                      这件事需要 {totalAssignees} 个人各做一部分 ·{' '}
                      你确认一下你的那部分就好
                    </div>
                  )}
                  {subtasksForMe.length > 0 && (
                    <div className="text-small text-ink-700 mb-3">
                      你的部分（{subtasksForMe.length} 件事）：
                      <ul className="mt-1.5 space-y-0.5">
                        {subtasksForMe.map((s) => (
                          <li key={s.id} className="text-ink-700">
                            · {s.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!showRejectPicker ? (
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-rouge" onClick={() => handleRespond('accepted')}>
                        <Check size={12} />
                        我可以陪着
                      </button>
                      <button
                        className="btn-outline"
                        onClick={() => setShowRejectPicker(true)}
                      >
                        <X size={12} />
                        我最近不方便
                      </button>
                      <button className="btn-ghost" onClick={() => handleRespond('snoozed')}>
                        <Clock size={12} />
                        晚点回复
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-tiny text-ink-500 mb-2">和家人说一声原因（可选）：</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {REJECT_REASONS.map((r) => (
                          <button
                            key={r}
                            onClick={() => setRejectReason(r)}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-tiny border transition',
                              rejectReason === r
                                ? 'border-rouge-500 bg-rouge-100 text-rouge-700'
                                : 'border-ink-300 text-ink-700 hover:border-ink-700',
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full bg-paper-50 border border-ink-300 px-3 py-2 text-small focus:border-ink-700 outline-none mb-3"
                        placeholder="或者自己写一句"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-rouge" onClick={() => handleRespond('rejected')}>
                          <Send size={12} />
                          告诉家人
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setShowRejectPicker(false)
                            setRejectReason('')
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )
            )}

            {/* 多人任务总进度（不是 owner 的人也能看到） */}
            {isMultiPerson && task.status !== 'completed' && !isOwnerOfThis && (
              <section className="rounded-2xl border border-paper-200 bg-paper-50 px-5 py-3">
                <div className="text-small text-ink-700 flex items-center gap-3 flex-wrap">
                  <span className="eyebrow text-ink-500">家里这条事</span>
                  <span>{acceptedCount} / {totalAssignees} 人已经回应</span>
                  {acceptedCount > 0 && acceptedCount < totalAssignees && (
                    <span className="text-tiny text-ink-400">还在等其他家人</span>
                  )}
                </div>
              </section>
            )}

            {/* 原始消息（pro mode only） */}
            {!isSimple && sourceMessages.length > 0 && (
              <section>
                <div className="eyebrow mb-4">原始消息</div>
                <div className="space-y-3">
                  {sourceMessages.map((m) => {
                    const member = members.find((mem) => mem.id === m.speakerId)
                    return (
                      <div key={m.id} className="flex items-start gap-3 pb-3 border-b border-ink-100">
                        {member ? (
                          <Avatar member={member} size={24} />
                        ) : (
                          <div
                            className="w-6 h-6 bg-ink-200 text-ink-700 grid place-items-center text-tiny font-serif"
                            style={{ borderRadius: 2 }}
                          >
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

            {/* AI 解读 */}
            {task.aiExplanation && (
              <section className="border-l-2 border-rouge-500 pl-5">
                  <div className="eyebrow mb-2">
                  {isSimple ? '帮你整理' : '欧哈娜的理解'}
                </div>
                <p className="text-body text-ink-800 leading-relaxed">{task.aiExplanation}</p>
                {task.suggestionReason && (
                  <div className="mt-4 text-small text-ink-600 flex items-start gap-2 flex-wrap">
                    <span className="text-ink-400">可以问问</span>
                    <MemberPill id={task.suggestedOwnerId} />
                    <span className="text-ink-500">· {task.suggestionReason}</span>
                  </div>
                )}
              </section>
            )}

            {/* 行动清单 + per-subtask 指派 */}
            <section>
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <div className="eyebrow">{isSimple ? '可以怎么照应' : '照应步骤'}</div>
                  <div className="text-tiny text-ink-500 mt-1">
                    {task.subtasks.filter((s) => s.completed).length} / {task.subtasks.length} 已完成
                    {!isSimple && ' · 点头像换一位方便的人'}
                  </div>
                </div>
                {isOriginator && task.status !== 'completed' && (
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-outline text-tiny" onClick={handleAssignAll}>
                      <Wand2 size={12} />
                      帮我找方便的人
                    </button>
                    <button
                      className="btn-rouge text-tiny"
                      onClick={handleConfirmAndNotify}
                      disabled={assignedCount === 0}
                    >
                      <MessageSquareShare size={12} />
                      写好问候消息
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {(['before', 'during', 'after', 'general'] as const).map((phase) => {
                  const items = grouped[phase]
                  if (items.length === 0) return null
                  return (
                    <div key={phase}>
                      <div className="text-tiny text-ink-500 mb-2 italic font-serif">
                        {(isSimple ? PHASE_LABEL_SIMPLE : PHASE_LABEL)[phase]}
                      </div>
                      <ul className="space-y-2">
                        {items.map((s) => (
                          <li key={s.id} className="flex items-start gap-3 text-body">
                            <button
                              type="button"
                              onClick={() => toggleSubtask(task.id, s.id)}
                              className={cn(
                                'mt-1.5 w-3.5 h-3.5 border shrink-0 grid place-items-center transition',
                                s.completed
                                  ? 'bg-moss-500 border-moss-500'
                                  : 'border-ink-300 bg-paper hover:border-ink-700',
                              )}
                              aria-label={s.completed ? '取消完成' : '标记完成'}
                            >
                              {s.completed && <Check size={10} className="text-paper" />}
                            </button>
                            <span
                              className={cn(
                                'flex-1 leading-relaxed',
                                s.completed && 'line-through text-ink-400',
                              )}
                            >
                              {s.title}
                            </span>
                            {isOriginator && task.status !== 'completed' ? (
                              <OwnerPicker
                                value={s.ownerId}
                                suggestedId={s.suggestedOwnerId}
                                onChange={(id) => setSubtaskOwner(task.id, s.id, id)}
                                size="sm"
                              />
                            ) : (
                              s.ownerId && <MemberPill id={s.ownerId} size="xs" />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 完成证明 · 支持拍照上传 */}
            {(task.requiredProof && task.requiredProof.length > 0) || (task.attachments?.length ?? 0) > 0 ? (
              <section>
                <div className="eyebrow mb-3">{isSimple ? '拍张照片' : '留下安心的回音'}</div>
                {task.requiredProof && task.requiredProof.length > 0 && (
                  <div className="text-body text-ink-700 mb-3">
                    {task.requiredProof.join(' · ')}
                  </div>
                )}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-3">
                    {task.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-ink-200 bg-paper-50 overflow-hidden hover:border-ink-500"
                        title={a.fileName ?? '附件'}
                      >
                        <img
                          src={a.url}
                          alt={a.fileName ?? '附件'}
                          className="w-full h-24 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProofUpload}
                />
                <button
                  className="btn-outline text-tiny"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={12} />
                  {isSimple ? '拍照上传' : '分享一张让家人安心的照片'}
                </button>
              </section>
            ) : null}

            {/* 日历 / 地图 */}
            {(task.locationName || task.startDateTime) && (
              <section className="border-t border-ink-200 pt-6">
                <div className="eyebrow mb-3">日历 / 地图</div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-outline text-tiny" onClick={handleCalendarExport}>
                    <CalendarPlus size={12} />
                    导出 .ics
                  </button>
                  {task.locationName && (
                    <>
                      <button
                        className="btn-outline text-tiny"
                        onClick={() => handleOpenMaps('google')}
                      >
                        <MapPin size={12} />
                        Google Maps
                      </button>
                      <button
                        className="btn-outline text-tiny"
                        onClick={() => handleOpenMaps('apple')}
                      >
                        <MapPin size={12} />
                        Apple 地图
                      </button>
                    </>
                  )}
                </div>
                <div className="text-tiny text-ink-400 mt-2">
                  Google / Apple Calendar OAuth 待集成 · 当前先用 .ics 文件
                </div>
              </section>
            )}

            {/* 风险（pro mode only） */}
            {!isSimple && task.riskNotes && task.riskNotes.length > 0 && (
              <section>
                <div className="eyebrow mb-3 text-rouge-500">如果不接住</div>
                <ul className="space-y-1.5 text-body text-ink-700">
                  {task.riskNotes.map((r) => (
                    <li key={r} className="flex items-start gap-3">
                      <span className="text-rouge-500 mt-3 w-2 h-px bg-rouge-500 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 整体指派给一个人（旧流程） · 仅对没有多人子任务的简单任务显示 */}
            {isOriginator && task.status !== 'completed' && !isMultiPerson && (
              <section className="border-t border-ink-200 pt-8">
                <div className="eyebrow mb-3">或者：请一个人全程陪着</div>
                <p className="text-small text-ink-600 mb-5 max-w-xl">
                  如果这件小事不复杂，可以先问一位家人是否方便陪着完成。
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-3 py-2 border text-small transition',
                        acceptedOwner === m.id
                          ? 'border-rouge-500 bg-rouge-50 text-rouge-700'
                          : 'border-ink-300 text-ink-700 hover:border-ink-700',
                      )}
                      onClick={() => setAcceptedOwner(m.id)}
                    >
                      <Avatar member={m} size={18} />
                      {m.name}
                      {m.id === task.suggestedOwnerId && (
                        <span className="text-micro text-ink-500 italic">推荐</span>
                      )}
                    </button>
                  ))}
                </div>

                <label className="block mb-5">
                  <span className="text-tiny text-ink-500">希望什么时候前有回音</span>
                  <input
                    type="text"
                    value={editedDeadline}
                    onChange={(e) => setEditedDeadline(e.target.value)}
                    className="mt-1 w-full bg-paper-50 border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                    placeholder="例如：明天中午前 / 周一 9:20"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button className="btn-rouge" onClick={handleAccept} disabled={!acceptedOwner}>
                    <Send size={12} />
                    请 ta 一起照看
                  </button>
                  <button
                    className="btn-outline"
                    onClick={handleCopyShare}
                    disabled={!acceptedOwner}
                  >
                    <Copy size={12} />
                    复制问候消息
                  </button>
                </div>
              </section>
            )}

            {/* 底部 · 完成 / 删除 */}
            {isOriginator && (
              <section className="border-t border-ink-200 pt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    className="btn-ghost text-tiny"
                    onClick={() => {
                      markTaskCompleted(task.id)
                      onClose()
                    }}
                  >
                    <Check size={12} />
                    这件事已经安心了
                  </button>
                </div>
                <button
                  className="text-tiny text-ink-400 hover:text-rouge-500 inline-flex items-center gap-1"
                  onClick={() => {
                    if (confirm('不再保留这件牵挂吗？')) {
                      removeTask(task.id)
                      onClose()
                    }
                  }}
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </section>
            )}
          </div>
        </div>
      </div>

      {showAssignAll && task && (
        <AssignAllModal task={task} onClose={() => setShowAssignAll(false)} />
      )}
    </>
  )
}
