import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Send, Mic, Image as ImageIcon, Sparkles, Brain, X, Check,
  MessageCircle, ClipboardPaste, ArrowRight, CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Avatar } from '@/components/Avatar'
import { MemberPill } from '@/components/MemberPill'
import { FamilyChatInput } from '@/components/FamilyChatInput'
import { useAppStore } from '@/lib/store'
import { useIsElder } from '@/lib/useUiMode'
import { processFamilyMemoryMessage } from '@/lib/agents/familyMemoryAgent'
import { generateWorkflow } from '@/lib/agents/careWorkflowAgent'
import type { CareTask, FamilyMemoryEntry, SuggestedAction } from '@/lib/types'
import type { CapturedTask } from '@/lib/agents/taskCaptureAgent'
import { newId } from '@/lib/utilsId'
import { cn } from '@/lib/utils'

type Mode = 'chat' | 'paste'

const QUICK_PROMPTS = [
  '我想新增一个任务',
  '我记得一件事',
  '我不知道要怎么做',
  '我这周有空，可以帮忙',
  '帮我重新分配任务',
  '提醒家人不要忘记',
]

const INTENT_LABEL: Record<FamilyMemoryEntry['intent'], string> = {
  new_task: '识别到一个新任务',
  risk_signal: '识别到一个健康/风险信号',
  availability_update: '记下你的可用时段',
  care_note: '记下这个关心',
  question: '我回答一下',
  redistribution_request: '重新分配建议',
}

const CATEGORY_LABEL: Record<string, string> = {
  elderly_care: '老人照护',
  medical: '医疗复诊',
  child_school: '孩子学校',
  household_admin: '家务行政',
  reimbursement: '票据报销',
  general_family: '家事',
}

export function MemoryPage() {
  const isElder = useIsElder()
  const [params, setParams] = useSearchParams()
  const initialMode: Mode = params.get('mode') === 'paste' ? 'paste' : 'chat'
  // 老人版强制走 chat 模式（粘聊天对他们没意义）
  const [mode, setMode] = useState<Mode>(isElder ? 'chat' : initialMode)

  function switchMode(next: Mode) {
    setMode(next)
    if (next === 'chat') params.delete('mode')
    else params.set('mode', 'paste')
    setParams(params, { replace: true })
  }

  return (
    <>
      <PageHeader
        title={isElder ? '告诉 AI' : '家庭记忆助手'}
        description={
          isElder
            ? '想到什么 · 说一句就行 · AI 会帮你记下来或转告家人'
            : '家里散落的信息 · 都可以告诉 AI · 不必非要建任务'
        }
      />

      {/* 老人版隐藏 tab · 只保留 chat */}
      {!isElder && (
        <div className="max-w-5xl mx-auto px-8 lg:px-12 pt-2 pb-6">
          <div className="inline-flex border border-ink-300">
            <button
              onClick={() => switchMode('chat')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-tiny transition',
                mode === 'chat'
                  ? 'bg-ink-900 text-paper'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <MessageCircle size={12} />
              我想说一件事
            </button>
            <button
              onClick={() => switchMode('paste')}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 text-tiny transition border-l border-ink-300',
                mode === 'paste'
                  ? 'bg-ink-900 text-paper'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              <ClipboardPaste size={12} />
              粘一段群聊天
            </button>
          </div>
          <p className="text-tiny text-ink-500 mt-2 max-w-xl leading-snug">
            {mode === 'chat'
              ? '一句一句说就行 · AI 帮你整理成任务 / 提醒 / 责任建议。'
              : '把家庭群、医院提醒、学校通知整段贴进来 · AI 自动识别成多个任务。'}
          </p>
        </div>
      )}

      {mode === 'chat' || isElder ? <ChatMode /> : <PasteMode />}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Chat mode · 一句一句说                                                       */
/* -------------------------------------------------------------------------- */

function ChatMode() {
  const members = useAppStore((s) => s.familyMembers)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const tasks = useAppStore((s) => s.tasks)
  const entries = useAppStore((s) => s.familyMemoryEntries)
  const pushEntry = useAppStore((s) => s.pushFamilyMemoryEntry)
  const resolveEntry = useAppStore((s) => s.resolveFamilyMemoryEntry)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const pushToast = useAppStore((s) => s.pushToast)
  const pushNotification = useAppStore((s) => s.pushNotification)
  const isElder = useIsElder()

  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const me = useMemo(
    () => members.find((m) => m.id === currentUserId) ?? members[0],
    [members, currentUserId],
  )

  function handleSend(value?: string) {
    const raw = (value ?? text).trim()
    if (!raw) return
    const entry = processFamilyMemoryMessage({
      speakerId: currentUserId,
      rawMessage: raw,
      members,
      existingTasks: tasks,
    })
    pushEntry(entry)
    setText('')
  }

  function handleAction(entry: FamilyMemoryEntry, action: SuggestedAction) {
    // 已经处理过的 entry · 防止重复
    if (entry.resolution) return

    if (action.actionType === 'ignore') {
      resolveEntry(entry.id, 'ignored')
      pushToast('已忽略 · 但仍记在家庭记忆里', 'info')
      return
    }

    // "只记录，不建任务"（agent 用 notify_family + payload.note_only 表示）
    if (action.actionType === 'notify_family' && (action.payload as { note_only?: boolean } | undefined)?.note_only) {
      resolveEntry(entry.id, 'noted')
      pushToast('已记下，等需要时再来翻', 'success')
      return
    }

    if (action.actionType === 'create_task' && action.payload) {
      const payload = action.payload as {
        title: string
        category: CareTask['category']
        suggestedOwnerId?: string
        subtasks?: string[]
        dueDateText?: string
        aiExplanation?: string
        originatorId?: string
        originatorLabel?: string
      }
      const wf = generateWorkflow({
        id: newId('task'),
        title: payload.title,
        category: payload.category,
      })
      const subtasks =
        payload.subtasks && payload.subtasks.length > 0
          ? payload.subtasks.map((title, idx) => ({
              id: `${newId('sub')}-${idx}`,
              title,
              phase:
                idx === 0
                  ? ('before' as const)
                  : idx === payload.subtasks!.length - 1
                    ? ('after' as const)
                    : ('during' as const),
              completed: false,
              suggestedOwnerId: payload.suggestedOwnerId,
              ownerId: payload.suggestedOwnerId,
            }))
          : wf.subtasks
      const taskId = newId('task')
      const newTask: CareTask = {
        id: taskId,
        title: payload.title,
        category: payload.category,
        sourceMessageIds: [],
        sourceSummary: `家庭记忆 · ${entry.rawMessage}`,
        originatorId: payload.originatorId ?? entry.speakerId,
        originatorLabel: payload.originatorLabel,
        suggestedOwnerId: payload.suggestedOwnerId,
        suggestionReason: payload.aiExplanation,
        dueDateText: payload.dueDateText,
        status: 'pending_acceptance',
        urgency: 'medium',
        subtasks,
        requiredProof: wf.requiredProof,
        aiExplanation: payload.aiExplanation,
      }
      useAppStore.setState((s) => ({ tasks: [newTask, ...s.tasks] }))

      // 创建任务的同时，自动通知建议执行人（如果有）
      if (payload.suggestedOwnerId && payload.suggestedOwnerId !== currentUserId) {
        const ownerName = members.find((m) => m.id === payload.suggestedOwnerId)?.name ?? ''
        pushNotification({
          recipientId: payload.suggestedOwnerId,
          kind: 'assignment',
          message: `「${payload.title}」已指给你 · 截止 ${payload.dueDateText ?? '本周内'}`,
          taskId,
        })
        resolveEntry(entry.id, 'task_created', {
          taskId,
          notifiedOwnerId: payload.suggestedOwnerId,
        })
        pushToast(`已创建任务并通知 ${ownerName}`, 'success')
      } else {
        resolveEntry(entry.id, 'task_created', { taskId })
        pushToast(`已创建任务「${newTask.title}」`, 'success')
      }
      return
    }

    if (action.actionType === 'update_task') {
      resolveEntry(entry.id, 'noted')
      pushToast('已记下更新建议 · 在事项详情里二次确认', 'info')
      return
    }
    if (action.actionType === 'assign_owner') {
      resolveEntry(entry.id, 'noted')
      pushToast('已把这段可用时间记到家人档案', 'success')
      return
    }
  }

  function handleVoice() {
    pushToast('语音输入功能待集成 Speech-to-Text API · 演示先用这段示例', 'info')
    handleSend('妈妈说爸爸药快没了，弟弟说明天可能有空。')
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    pushToast(`图片 ${file.name} 已收到 · OCR 待集成`, 'info')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div
      className={cn(
        'max-w-4xl mx-auto px-8 lg:px-12 pb-20 grid gap-10',
        // 老人版：单栏 · 不显示侧边切身份
        isElder ? 'grid-cols-1' : 'lg:grid-cols-[1fr_280px]',
      )}
    >
      {/* 主对话 */}
      <div className="border-t border-ink-200 pt-8 space-y-8 min-w-0">
        {/* 历史记录 */}
        {entries.length === 0 ? (
          <div className="text-small text-ink-500 italic py-4">
            还没有人说话。试试下面的快捷示例。
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((e) => (
              <ChatBubble
                key={e.id}
                entry={e}
                onAction={(action) => handleAction(e, action)}
              />
            ))}
          </div>
        )}

        {/* 快捷示例 */}
        <div className="border-t border-ink-200 pt-6">
          {isElder ? (
            <>
              <div className="text-body text-ink-700 mb-3">想说什么？点一个就行：</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSend('我今天血压正常。')}
                  className="text-body border border-ink-300 px-4 py-2 text-ink-800 hover:border-ink-700"
                >
                  我今天血压正常
                </button>
                <button
                  onClick={() => handleSend('你爸今天早上血压有点高。')}
                  className="text-body border border-rouge-300 px-4 py-2 text-rouge-500 hover:bg-rouge-50"
                >
                  爸爸血压有点高
                </button>
                <button
                  onClick={() => handleSend('家里药快没了，请帮忙买一下。')}
                  className="text-body border border-rouge-300 px-4 py-2 text-rouge-500 hover:bg-rouge-50"
                >
                  药快没了
                </button>
                <button
                  onClick={() => handleSend('我想问一下复诊那天要带什么？')}
                  className="text-body border border-ink-300 px-4 py-2 text-ink-800 hover:border-ink-700"
                >
                  复诊要带什么
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="eyebrow mb-3">快捷示例</div>
              <div className="flex flex-wrap gap-2 mb-6">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setText(p)}
                    className="text-tiny border border-ink-300 px-2.5 py-1 text-ink-700 hover:border-ink-700 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="text-tiny text-ink-500 mb-2">
                示范：把家庭群里的一句话粘进来，看 AI 怎么拆。
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() =>
                    handleSend('你爸最近早上血压有点高，但是他说没事。')
                  }
                  className="text-tiny border border-rouge-300 px-2.5 py-1 text-rouge-500 hover:bg-rouge-50"
                >
                  示例 · 妈妈说血压
                </button>
                <button
                  onClick={() =>
                    handleSend('我周一上午可以陪爸去医院，但我不知道要带什么。')
                  }
                  className="text-tiny border border-rouge-300 px-2.5 py-1 text-rouge-500 hover:bg-rouge-50"
                >
                  示例 · 弟弟问要带什么
                </button>
                <button
                  onClick={() =>
                    handleSend('我这周五下午在家，可以处理燃气年检。')
                  }
                  className="text-tiny border border-rouge-300 px-2.5 py-1 text-rouge-500 hover:bg-rouge-50"
                >
                  示例 · 周勉报可用时间
                </button>
                <button
                  onClick={() =>
                    handleSend('我最近不想再负责所有父母医疗任务，能不能帮我重新分配？')
                  }
                  className="text-tiny border border-rouge-300 px-2.5 py-1 text-rouge-500 hover:bg-rouge-50"
                >
                  示例 · 唐宁要求重新分配
                </button>
              </div>
            </>
          )}
        </div>

        {/* 输入区 */}
        <div className="border-t border-ink-200 pt-6">
          <div className="flex items-start gap-3">
            <Avatar member={me} size={isElder ? 48 : 36} />
            <div className="flex-1 min-w-0">
              <div className={cn(isElder ? 'text-body' : 'text-tiny', 'text-ink-500 mb-2')}>
                {isElder ? '想说什么，自己打字也可以：' : (
                  <>现在以 <span className="text-ink-900 font-medium">{me?.name}</span> 的身份说一句</>
                )}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={isElder ? 4 : 3}
                className={cn(
                  'w-full bg-paper-50 border border-ink-300 focus:border-ink-700 outline-none resize-none',
                  isElder ? 'px-4 py-3 text-lead' : 'px-3 py-2 text-body',
                )}
                placeholder={`例如：你爸今天早上血压 148/92，要紧吗？`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
                }}
              />
              <div className={cn('mt-3 flex flex-wrap items-center gap-2', isElder && 'gap-3 mt-4')}>
                <button
                  onClick={() => handleSend()}
                  className={cn('btn-rouge', isElder ? 'text-body px-5 py-2.5' : 'text-tiny')}
                  disabled={!text.trim()}
                >
                  <Send size={isElder ? 14 : 12} />
                  发送给 AI
                </button>
                <button
                  onClick={handleVoice}
                  className={cn('btn-outline', isElder ? 'text-body px-5 py-2.5' : 'text-tiny')}
                  title="语音输入"
                >
                  <Mic size={isElder ? 14 : 12} />
                  语音输入
                </button>
                {!isElder && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImage}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="btn-outline text-tiny"
                      title="把截图给 AI"
                    >
                      <ImageIcon size={12} />
                      图片
                    </button>
                    <span className="text-tiny text-ink-400 ml-auto">
                      ⌘/Ctrl + Enter 发送
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧 · 谁在说话 · 老人版隐藏 */}
      {!isElder && (
        <aside className="border-t border-ink-200 pt-8 lg:pl-6 lg:border-l lg:border-t-0">
          <div className="eyebrow mb-3 inline-flex items-center gap-1.5">
            <Sparkles size={11} />
            现在以谁的身份说
          </div>
          <ul className="space-y-1">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => setCurrentUser(m.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition',
                    m.id === currentUserId
                      ? 'bg-paper-100 border-l-2 border-rouge-500'
                      : 'border-l-2 border-transparent hover:bg-paper-50',
                  )}
                >
                  <Avatar member={m} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="text-small text-ink-900 truncate">
                      {m.name}{' '}
                      <span className="text-tiny text-ink-400 font-normal">
                        · {m.relation}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}

function ChatBubble({
  entry,
  onAction,
}: {
  entry: FamilyMemoryEntry
  onAction: (a: SuggestedAction) => void
}) {
  const speaker = useAppStore((s) =>
    s.familyMembers.find((m) => m.id === entry.speakerId),
  )
  const isResolved = !!entry.resolution
  const isIgnored = entry.resolution === 'ignored'

  return (
    <div className={cn('space-y-3', isIgnored && 'opacity-60')}>
      {/* 用户消息 */}
      <div className="flex items-start gap-3">
        {speaker ? (
          <Avatar member={speaker} size={28} />
        ) : (
          <div className="w-7 h-7 bg-ink-200" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-tiny text-ink-500 mb-1">
            {speaker?.name ?? '匿名'} · 说
          </div>
          <div className="bg-paper-50 border border-ink-200 px-4 py-3 text-body text-ink-800 leading-relaxed">
            {entry.rawMessage}
          </div>
        </div>
      </div>

      {/* AI 回复 + 结构化结果 */}
      <div className="flex items-start gap-3 pl-10">
        <div className="w-7 h-7 bg-rouge-500 text-paper grid place-items-center" style={{ borderRadius: 2 }}>
          <Brain size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-tiny text-rouge-500 mb-1">
            {INTENT_LABEL[entry.intent]}
          </div>
          <div className="bg-paper border border-rouge-200 px-4 py-3 space-y-3">
            <p className="text-body text-ink-800 leading-relaxed">{entry.aiSummary}</p>

            {entry.extractedTitle && (
              <div className="text-small text-ink-700">
                <span className="text-ink-400 mr-1.5">建议任务：</span>
                <span className="font-medium">{entry.extractedTitle}</span>
                {entry.suggestedDeadline && (
                  <span className="text-ink-500 ml-2">· 截止 {entry.suggestedDeadline}</span>
                )}
              </div>
            )}

            {entry.suggestedOwnerId && (
              <div className="text-small text-ink-700 flex items-center gap-1.5">
                <span className="text-ink-400">建议交给：</span>
                <MemberPill id={entry.suggestedOwnerId} size="xs" />
              </div>
            )}

            {entry.suggestedSubtasks && entry.suggestedSubtasks.length > 0 && (
              <ul className="text-small text-ink-700 space-y-1">
                {entry.suggestedSubtasks.map((s, idx) => (
                  <li key={idx}>· {s}</li>
                ))}
              </ul>
            )}

            <div className="pt-2 border-t border-ink-100">
              {isResolved ? (
                <ResolutionChip entry={entry} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {entry.suggestedActions.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => onAction(a)}
                      className={cn(
                        'text-tiny px-3 py-1.5 border transition inline-flex items-center gap-1.5',
                        a.actionType === 'ignore'
                          ? 'border-ink-200 text-ink-500 hover:border-ink-400'
                          : a.actionType === 'create_task'
                            ? 'border-rouge-500 bg-rouge-500 text-paper hover:bg-rouge-600'
                            : 'border-ink-300 text-ink-700 hover:border-ink-700',
                      )}
                    >
                      {a.actionType === 'ignore' && <X size={11} />}
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResolutionChip({ entry }: { entry: FamilyMemoryEntry }) {
  const notified = useAppStore((s) =>
    entry.notifiedOwnerId
      ? s.familyMembers.find((m) => m.id === entry.notifiedOwnerId)
      : undefined,
  )

  if (entry.resolution === 'task_created') {
    return (
      <div className="flex items-center gap-2 text-tiny text-moss-500">
        <Check size={12} />
        已创建任务
        {notified && (
          <span className="text-ink-500">· 已通知 {notified.name}</span>
        )}
        {entry.resolvedTaskId && (
          <a href="/me?view=all" className="ml-auto text-ink-500 hover:text-rouge-500 inline-flex items-center gap-1">
            去看看
            <ArrowRight size={11} />
          </a>
        )}
      </div>
    )
  }
  if (entry.resolution === 'noted') {
    return (
      <div className="flex items-center gap-2 text-tiny text-ink-500">
        <Check size={12} />
        已记下 · 还没建成任务，需要时可以再翻
      </div>
    )
  }
  if (entry.resolution === 'ignored') {
    return (
      <div className="flex items-center gap-2 text-tiny text-ink-400">
        <X size={12} />
        已忽略
      </div>
    )
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Paste mode · 一整段群聊天                                                    */
/* -------------------------------------------------------------------------- */

function PasteMode() {
  const navigate = useNavigate()
  const ingest = useAppStore((s) => s.ingestCapturedTasks)
  const pushToast = useAppStore((s) => s.pushToast)

  const [captured, setCaptured] = useState<CapturedTask[]>([])
  const [llmMode, setLlmMode] = useState<'mock' | 'remote' | null>(null)
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(0)

  function handleSaveAll() {
    const added = ingest(captured)
    setSavedCount(added.length)
    pushToast(
      added.length > 0
        ? `已加入 ${added.length} 条新任务到列表`
        : '这些任务已经在你的列表里了',
      added.length > 0 ? 'success' : 'info',
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 lg:px-12 pb-20 grid lg:grid-cols-2 gap-12">
      <div className="border-t border-ink-200 pt-8">
        <FamilyChatInput
          onCaptured={(tasks, m, err) => {
            setCaptured(tasks)
            setLlmMode(m)
            setRemoteError(err ?? null)
            setSavedCount(0)
          }}
        />
      </div>

      <div className="border-t border-ink-200 pt-8 space-y-6">
        <div className="flex items-end justify-between">
          <div className="eyebrow">
            {captured.length > 0 ? `识别到 ${captured.length} 条` : 'AI 识别结果'}
          </div>
          {llmMode && (
            <span
              className={cn(
                'text-tiny',
                llmMode === 'remote' ? 'text-moss-500' : 'text-ink-500',
              )}
            >
              {llmMode === 'remote' ? 'DeepSeek 实时' : '本地逻辑'}
            </span>
          )}
        </div>

        {remoteError && (
          <div className="border-l-2 border-rouge-500 bg-rouge-50 px-4 py-3 text-tiny text-rouge-700">
            远程调用失败，已回退到本地逻辑。
            <div className="mt-1 text-ink-500 break-all">详细：{remoteError}</div>
          </div>
        )}

        {captured.length === 0 && (
          <div className="border-t border-ink-200 pt-10 pb-16 text-center">
            <p className="text-small text-ink-500 max-w-xs mx-auto leading-relaxed">
              点左边的「AI 识别任务」按钮。
              <br />
              可以用示例消息，也可以粘贴你自己的家庭群。
            </p>
          </div>
        )}

        {captured.length > 0 && (
          <>
            <ul className="space-y-0 border-t border-ink-200">
              {captured.map((c, idx) => (
                <li
                  key={c.id}
                  className="border-b border-ink-200 py-5 animate-fade-up"
                  style={{ animationDelay: `${idx * 70}ms` }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="eyebrow">
                      {CATEGORY_LABEL[c.category] ?? c.category}
                    </div>
                    <span className="text-tiny text-ink-400">
                      {Math.round(c.confidence * 100)}% 置信
                    </span>
                  </div>
                  <h3 className="font-serif text-h3 text-ink-900 leading-tight mt-1.5">
                    {c.title}
                  </h3>
                  {c.dueDateText && (
                    <div className="text-small text-rouge-500 mt-1">{c.dueDateText}</div>
                  )}
                  {c.matchedLine && (
                    <p className="text-small text-ink-500 mt-2 leading-relaxed">
                      原文：{c.matchedLine}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-tiny text-ink-500">
                    <span className="text-ink-400">建议</span>
                    <MemberPill id={c.suggestedOwnerId} size="xs" />
                    {c.suggestionReason && (
                      <span className="text-ink-500">· {c.suggestionReason}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4 pt-2">
              <button onClick={handleSaveAll} className="btn-rouge">
                <CheckCircle2 size={14} />
                全部加入任务列表
              </button>
              {savedCount > 0 && (
                <button
                  onClick={() => navigate('/me?view=all')}
                  className="text-small text-ink-700 hover:text-rouge-500 inline-flex items-center gap-1"
                >
                  去事项页查看
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
