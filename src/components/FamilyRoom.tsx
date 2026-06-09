import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  BookOpen,
  BookmarkPlus,
  Bot,
  Check,
  Heart,
  Image as ImageIcon,
  Mic,
  Pencil,
  Pin,
  Reply,
  Search,
  Shield,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from './Avatar'
import { useAppStore } from '@/lib/store'
import {
  answerFromOhana,
  canViewHouseholdMemory,
  draftHouseholdMemory,
  isCareRequestCandidate,
  isRememberableFamilyFact,
} from '@/lib/agents/familyConversationAgent'
import { analyzeFamilyMessages, captureTasksFromMessages } from '@/lib/agents/taskCaptureAgent'
import { getLLMProviderLabel, hasDeepSeekKey } from '@/lib/llm/llmClient'
import { newId } from '@/lib/utilsId'
import { cn } from '@/lib/utils'
import type {
  FamilyChatAudience,
  FamilyChatMessage,
  FamilyChatReactionKind,
  FamilyMember,
  CareTask,
  HouseholdMemory,
  HouseholdMemoryPhoto,
  HouseholdMemoryVisibility,
} from '@/lib/types'

const FAMILY_STARTERS = [
  '今天大家都好吗？',
  '我今天有件开心的小事想分享：',
  '今晚想给大家打个电话。',
  '医药卡在玄关柜第二层的蓝色文件袋里。',
]

const ASSISTANT_STARTERS = [
  '医药卡在哪里？',
  '27 March 9:30am 带爸爸去医院',
  '化疗常见会有哪些不适？',
]

function looksLikeArrangement(text: string): boolean {
  const asksAQuestion = /[?？]\s*$/.test(text.trim())
  if (asksAQuestion && !/(提醒|安排|加入|记下|schedule|remind)/i.test(text)) return false
  return /(复诊|挂号|预约|医院|体检|年检|幼儿园|学校|带.{0,8}(爸|妈|孩子).{0,8}(医院|门诊)|\b(?:bring|take)\s+(?:papa|dad|father|mummy|mom|mother).{0,20}(?:hospital|clinic|doctor)|\bappointment\b|\b\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(text)
}

function shouldAutoOrganizeFamilyMessage(text: string): boolean {
  const asksAQuestion = /[?？]\s*$/.test(text.trim())
  if (asksAQuestion && !/(请|帮|麻烦|提醒|安排|加入|记下|schedule|remind)/i.test(text)) {
    return false
  }
  return looksLikeArrangement(text) || isCareRequestCandidate(text)
}

function photoFromFile(file: File, uploadedById: string): Promise<HouseholdMemoryPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('无法读取照片'))
        return
      }
      const image = new Image()
      image.onload = () => {
        const maxSide = 1000
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * ratio))
        canvas.height = Math.max(1, Math.round(image.height * ratio))
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('无法处理照片'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve({
          id: newId('photo'),
          dataUrl: canvas.toDataURL('image/jpeg', 0.78),
          fileName: file.name,
          uploadedById,
          createdAt: Date.now(),
        })
      }
      image.onerror = () => reject(new Error('无法处理照片'))
      image.src = reader.result
    }
    reader.onerror = () => reject(new Error('无法读取照片'))
    reader.readAsDataURL(file)
  })
}

export type FamilyRoomView = 'family' | 'assistant' | 'memories'

interface Props {
  initialText?: string
  initialAudience?: FamilyChatAudience
  view?: FamilyRoomView
  onViewChange?: (view: FamilyRoomView) => void
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void
  onerror: () => void
  onend: () => void
  start: () => void
}

export function FamilyRoom({
  initialText = '',
  initialAudience = 'family',
  view,
  onViewChange,
}: Props) {
  const members = useAppStore((s) => s.familyMembers)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const messages = useAppStore((s) => s.familyChatMessages)
  const memories = useAppStore((s) => s.householdMemories)
  const tasks = useAppStore((s) => s.tasks)
  const pushMessage = useAppStore((s) => s.pushFamilyChatMessage)
  const ingestCapturedTasks = useAppStore((s) => s.ingestCapturedTasks)
  const toggleReaction = useAppStore((s) => s.toggleChatReaction)
  const createCareRequest = useAppStore((s) => s.createCareTaskFromChatMessage)
  const addMemory = useAppStore((s) => s.addHouseholdMemory)
  const updateMemory = useAppStore((s) => s.updateHouseholdMemory)
  const removeMemory = useAppStore((s) => s.removeHouseholdMemory)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const pushToast = useAppStore((s) => s.pushToast)

  const [familyText, setFamilyText] = useState(initialAudience === 'family' ? initialText : '')
  const [assistantText, setAssistantText] = useState(initialAudience === 'assistant' ? initialText : '')
  const [answering, setAnswering] = useState(false)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const llmProvider = getLLMProviderLabel() ?? 'AI 服务'
  const conversationRef = useRef<HTMLDivElement>(null)
  const activeView = view ?? (initialAudience === 'assistant' ? 'assistant' : 'family')
  const audience: FamilyChatAudience = activeView === 'assistant' ? 'assistant' : 'family'
  const text = audience === 'assistant' ? assistantText : familyText
  const setText = audience === 'assistant' ? setAssistantText : setFamilyText

  const me = useMemo(
    () => members.find((member) => member.id === currentUserId) ?? members[0],
    [members, currentUserId],
  )
  const visibleMemories = useMemo(
    () => memories.filter((memory) => canViewHouseholdMemory(memory, currentUserId)),
    [memories, currentUserId],
  )
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          activeView === 'family'
            ? message.audience === 'family'
            : message.audience === 'assistant' && message.speakerId === currentUserId,
      ),
    [messages, currentUserId, activeView],
  )
  const ohanaHistory = useMemo(
    () =>
      messages
        .filter(
          (message) =>
            message.audience === 'assistant' &&
            message.speakerId === currentUserId,
        )
        .slice(-8)
        .map((message) => ({
          role: message.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: message.body.slice(0, 1200),
        })),
    [messages, currentUserId],
  )
  const replyTo = visibleMessages.find((message) => message.id === replyToId)

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [visibleMessages.length, answering])

  function saveMemory(
    raw: string,
    createdById?: string,
    sourceMessageId?: string,
    visibility: HouseholdMemoryVisibility = 'family',
    sharedWithIds?: string[],
    photos?: HouseholdMemoryPhoto[],
  ) {
    const memory = addMemory(
      {
        ...draftHouseholdMemory(raw, createdById, sourceMessageId, visibility, sharedWithIds),
        photos,
      },
    )
    pushToast(`已记在家庭记忆本：${memory.title}`, 'success')
  }

  async function handleSend(value?: string, target: FamilyChatAudience = audience) {
    const raw = (value ?? text).trim()
    if (!raw || answering) return
    let priorTaskIds: string[] = []
    if (target === 'assistant') {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const previous = messages[index]
        if (
          previous.role === 'family' &&
          previous.audience === 'assistant' &&
          previous.speakerId === currentUserId &&
          previous.body.trim() === raw
        ) {
          const previousAnswer = messages
            .slice(index + 1)
            .find((entry) => entry.role === 'assistant' && (entry.taskIds?.length ?? 0) > 0)
          priorTaskIds = previousAnswer?.taskIds ?? []
          break
        }
      }
    }

    const message: FamilyChatMessage = {
      id: newId('chat'),
      role: 'family',
      speakerId: currentUserId,
      audience: target,
      body: raw,
      createdAt: Date.now(),
      visibility: target === 'family' ? 'family' : 'private',
      replyToId: target === 'family' ? replyToId ?? undefined : undefined,
    }
    pushMessage(message)
    setText('')
    setReplyToId(null)

    if (target === 'family') {
      if (shouldAutoOrganizeFamilyMessage(raw)) {
        const captured = captureTasksFromMessages(raw, { members, currentUserId })
        const linkedTasks = ingestCapturedTasks(captured, message.id)
        if (linkedTasks.length > 0) {
          pushToast('已把这项安排放进「为你留意」，家人可以直接接手', 'success')
        }
      }
      return
    }

    setAnswering(true)
    if (looksLikeArrangement(raw)) {
      if (priorTaskIds.length > 0) {
        pushMessage({
          id: newId('chat'),
          role: 'assistant',
          speakerId: currentUserId,
          audience: 'assistant',
          visibility: 'private',
          body: '这项安排已经在「为你留意」里了，家人可以继续接手或补充资料。',
          answerMode: 'task',
          taskIds: priorTaskIds,
          createdAt: Date.now(),
        })
        setAnswering(false)
        return
      }
      const captureResult = await analyzeFamilyMessages(raw, { members, currentUserId })
      const addedTasks = ingestCapturedTasks(captureResult.data)
      if (captureResult.remoteError) {
        pushToast('在线整理暂时不可用，已用本地规则识别安排。', 'warn')
      }
      if (captureResult.data.length > 0) {
        const shownTasks =
          addedTasks.length > 0
            ? addedTasks
            : tasks.filter((task) =>
                captureResult.data.some(
                  (captured) =>
                    captured.title === task.title &&
                    captured.dueDateText === task.dueDateText,
                ),
              )
        pushMessage({
          id: newId('chat'),
          role: 'assistant',
          speakerId: currentUserId,
          audience: 'assistant',
          visibility: 'private',
          body:
            addedTasks.length > 0
              ? `我已把这项安排整理成 ${addedTasks.length} 件待家人接手的事项，放进「为你留意」了。`
              : '这项安排已经在「为你留意」里了，家人可以继续接手或补充资料。',
          answerMode: 'task',
          taskIds: shownTasks.map((task) => task.id),
          createdAt: Date.now(),
        })
        setAnswering(false)
        return
      }
    }
    const result = await answerFromOhana({
      question: raw,
      memories: visibleMemories,
      history: ohanaHistory,
    })
    if (result.remoteError) {
      pushToast(`${llmProvider} 暂时没连上，已改用本地记忆回答。`, 'warn')
    }
    pushMessage({
      id: newId('chat'),
      role: 'assistant',
      speakerId: currentUserId,
      audience: 'assistant',
      visibility: 'private',
      body: result.data.text,
      memoryIds: result.data.memoryIds,
      answerMode: result.mode === 'remote' ? 'ai' : 'memory',
      createdAt: Date.now(),
    })
    setAnswering(false)
  }

  function handleVoice() {
    const SpeechRecognitionCtor = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike
        webkitSpeechRecognition?: new () => SpeechRecognitionLike
      }
    ).SpeechRecognition ?? (
      window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    ).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      pushToast('这个浏览器暂不支持语音转文字，可以先打字留言。', 'info')
      return
    }
    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const words = event.results[0]?.[0]?.transcript?.trim()
      if (words) setText((existing) => `${existing}${existing ? ' ' : ''}${words}`)
    }
    recognition.onerror = () => {
      setListening(false)
      pushToast('没有听清楚，再试一次或直接打字吧。', 'info')
    }
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  if (activeView === 'memories') {
    return (
      <div className="max-w-4xl mx-auto px-6 lg:px-12 pb-20">
        <MemoryShelf
          memories={visibleMemories}
          members={members}
          currentUserId={currentUserId}
          onSaveMemory={saveMemory}
          onUpdateMemory={updateMemory}
          onRemoveMemory={removeMemory}
          onAsk={(question) => {
            setAssistantText(question)
            onViewChange?.('assistant')
          }}
          fullPage
        />
      </div>
    )
  }

  return (
    <div
      className="max-w-6xl mx-auto px-6 lg:px-12 pb-20 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]"
    >
      <section className="petal-card overflow-hidden flex flex-col min-h-[500px] md:min-h-[620px]">
        <div ref={conversationRef} className="flex-1 min-h-[190px] md:min-h-[300px] max-h-[430px] md:max-h-[560px] overflow-y-auto px-5 md:px-7 py-5 md:py-6">
          {visibleMessages.length === 0 ? (
            <div className="h-full min-h-[180px] md:min-h-[250px] rounded-3xl bg-honey-50 border border-honey-100 p-5 md:p-7 flex flex-col justify-center">
              <Sparkles size={20} className="text-rouge-500 mb-4" />
              <h3 className="font-serif text-h3 text-ink-900">从一句普通的话开始</h3>
              <p className="text-small text-ink-600 leading-relaxed mt-3 max-w-md">
                {audience === 'family'
                  ? '问声好、分享小开心，或告诉家人一件值得记住的事。'
                  : '问物品放在哪里，或直接说出一项安排，例如「27 March 9:30am 带爸爸去医院」。'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {visibleMessages.map((message) => (
                <FamilyMessageBubble
                  key={message.id}
                  message={message}
                  messages={visibleMessages}
                  tasks={tasks}
                  memories={visibleMemories}
                  currentUserId={currentUserId}
                  onSaveMemory={(visibility) =>
                    saveMemory(message.body, message.speakerId, message.id, visibility)
                  }
                  onReply={() => {
                    setReplyToId(message.id)
                  }}
                  onReact={(kind) => toggleReaction(message.id, currentUserId, kind)}
                  onCreateCareRequest={() => createCareRequest(message.id)}
                />
              ))}
              {answering && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-honey-100 text-rouge-500 grid place-items-center">
                    <Bot size={15} />
                  </div>
                  <div className="rounded-2xl rounded-tl-md bg-honey-50 border border-honey-100 px-4 py-3 text-small text-ink-500">
                    欧哈娜正在想一想...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-paper-200 bg-paper-50/55 px-5 md:px-7 py-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {(audience === 'family'
              ? FAMILY_STARTERS
              : ASSISTANT_STARTERS
            ).map((prompt) => (
              <button
                type="button"
                key={prompt}
                onClick={() => setText(prompt)}
                className="text-tiny rounded-full border border-paper-200 bg-paper px-3 py-1.5 text-ink-600 hover:border-rouge-200 hover:bg-rouge-50 transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {audience === 'assistant' && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-honey-50 border border-honey-100 px-3 py-2.5 text-tiny text-ink-600">
              <Bot size={13} className="mt-0.5 shrink-0 text-rouge-500" />
              <span>
                {hasDeepSeekKey() ? '欧哈娜会用 AI 对话，也能找回家中的记忆。' : '当前未连接 AI，只能先查找家庭记忆。'}
                <span className="block text-ink-400 mt-0.5">
                  {hasDeepSeekKey()
                    ? `发送问题时，会把最近 4 轮私聊前文、问题和相关记忆发送到 ${llmProvider}。`
                    : '在设置中配置 AI 后，也可以询问生活与健康常识。'}
                </span>
              </span>
            </div>
          )}

          {replyTo && audience === 'family' && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl bg-honey-50 border border-honey-100 px-3 py-2">
              <div className="text-tiny text-ink-600 min-w-0">
                <span className="text-rouge-600">正在回复</span>
                <span className="ml-2 line-clamp-1">{replyTo.body}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyToId(null)}
                aria-label="取消回复"
                className="text-ink-400 hover:text-ink-700"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div className="flex items-start gap-3">
            {me && <Avatar member={me} size={36} />}
            <div className="flex-1 min-w-0">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                className="w-full bg-paper border border-paper-200 focus:border-rouge-300 outline-none resize-none px-4 py-3 text-body"
                placeholder={
                  audience === 'family'
                    ? '例如：今天大家都好吗？我有一件开心的小事想分享。'
                    : '例如：医药卡在哪里？化疗常见会有哪些不适？'
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    void handleSend()
                  }
                }}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!text.trim() || answering}
                  className="btn-rouge text-tiny"
                >
                  <Send size={12} />
                  {audience === 'family' ? '发送给家人' : '问一问'}
                </button>
                <button type="button" onClick={handleVoice} className="btn-outline text-tiny">
                  <Mic size={12} />
                  {listening ? '正在听...' : '语音'}
                </button>
                <span className="ml-auto text-tiny text-ink-400">Ctrl / Cmd + Enter</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-5 lg:self-start">
        {audience === 'assistant' ? (
          <section className="home-note p-5">
            <div className="eyebrow mb-3 inline-flex items-center gap-1.5">
              <Bot size={12} />
              只属于你的对话
            </div>
            <p className="text-small text-ink-600 leading-relaxed mb-4">
              这里不会发进全家聊天。直接写安排，欧哈娜也会整理成家人可接手的事项。
            </p>
            <button type="button" onClick={() => onViewChange?.('memories')} className="btn-outline text-tiny w-full">
              <BookOpen size={12} />
              去家庭记忆找位置照片
            </button>
          </section>
        ) : (
          <section className="home-note p-5">
            <div className="eyebrow mb-3">现在谁在说话</div>
            <ul className="space-y-1">
              {members.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => setCurrentUser(member.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition',
                      member.id === currentUserId ? 'bg-rouge-50' : 'hover:bg-paper',
                    )}
                  >
                    <Avatar member={member} size={25} />
                    <span className="text-small text-ink-800">{member.name}</span>
                    <span className="text-tiny text-ink-400">· {member.relation}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  )
}

function FamilyMessageBubble({
  message,
  messages,
  tasks,
  memories,
  currentUserId,
  onSaveMemory,
  onReply,
  onReact,
  onCreateCareRequest,
}: {
  message: FamilyChatMessage
  messages: FamilyChatMessage[]
  tasks: CareTask[]
  memories: HouseholdMemory[]
  currentUserId: string
  onSaveMemory: (visibility: HouseholdMemoryVisibility) => void
  onReply: () => void
  onReact: (kind: FamilyChatReactionKind) => void
  onCreateCareRequest: () => string | null
}) {
  const speaker = useAppStore((s) =>
    message.speakerId
      ? s.familyMembers.find((member) => member.id === message.speakerId)
      : undefined,
  )
  const cited = memories.filter((memory) => message.memoryIds?.includes(memory.id))
  const savedMemory = memories.find((memory) => memory.sourceMessageId === message.id)
  const quotedMessage = messages.find((other) => other.id === message.replyToId)
  const linkedTasks = tasks.filter((task) => task.sourceMessageIds.includes(message.id))
  const heartCount = (message.reactions ?? []).filter((reaction) => reaction.kind === 'heart').length
  const seenCount = (message.reactions ?? []).filter((reaction) => reaction.kind === 'seen').length
  const hasHeart = (message.reactions ?? []).some(
    (reaction) => reaction.kind === 'heart' && reaction.memberId === currentUserId,
  )
  const hasSeen = (message.reactions ?? []).some(
    (reaction) => reaction.kind === 'seen' && reaction.memberId === currentUserId,
  )
  const isMine = message.speakerId === currentUserId

  if (message.role === 'assistant') {
    const extractedTasks = tasks.filter((task) => message.taskIds?.includes(task.id))
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-honey-100 text-rouge-500 grid place-items-center shrink-0">
          <Bot size={15} />
        </div>
        <div className="min-w-0 max-w-[92%]">
          <div className="text-tiny text-rouge-500 mb-1">
            {message.answerMode === 'task'
              ? '欧哈娜 · 已整理事项'
              : message.answerMode === 'ai'
                ? '欧哈娜 · AI 助手'
                : '欧哈娜 · 家庭记忆'}
          </div>
          <div className="rounded-2xl rounded-tl-md bg-honey-50 border border-honey-100 px-4 py-3">
            <p className="text-body text-ink-800 leading-relaxed whitespace-pre-line">{message.body}</p>
            {extractedTasks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-honey-100 space-y-2">
                {extractedTasks.map((task) => (
                  <Link
                    key={task.id}
                    to="/me?view=all"
                    className="block rounded-xl border border-rouge-100 bg-paper px-3 py-2 hover:border-rouge-200"
                  >
                    <div className="text-tiny text-rouge-600">已整理为待接手事项</div>
                    <div className="text-small font-medium text-ink-800 mt-1">{task.title}</div>
                    {task.dueDateText && (
                      <div className="text-tiny text-ink-500 mt-1">时间：{task.dueDateText}</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
            {cited.length > 0 && (
              <div className="mt-3 pt-3 border-t border-honey-100 space-y-2">
                {cited.map((memory) => (
                  <div key={memory.id} className="rounded-xl bg-paper px-3 py-2 text-tiny text-ink-500">
                    <div>来源：{memory.title}</div>
                    {(memory.photos ?? []).length > 0 && (
                      <div className="mt-2 flex gap-2 overflow-x-auto">
                        {memory.photos?.map((photo) => (
                          <img
                            key={photo.id}
                            src={photo.dataUrl}
                            alt={`${memory.title} 的位置照片`}
                            className="h-20 w-20 rounded-lg object-cover border border-paper-200"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-start gap-3', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine && speaker && <Avatar member={speaker} size={30} />}
      <div className={cn('min-w-0 max-w-[88%]', isMine ? 'text-right' : 'text-left')}>
        <div className="text-tiny text-ink-500 mb-1">
          {speaker?.name ?? '家人'}
          {message.audience === 'assistant' ? ' · 问欧哈娜' : ' · 发给家人'}
        </div>
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-left',
            isMine
              ? 'rounded-tr-md bg-rouge-50 border-rouge-100'
              : 'rounded-tl-md bg-moss-50 border-moss-100',
          )}
        >
          {quotedMessage && (
            <div
              className={cn(
                'mb-2 rounded-xl bg-paper/60 border-l-2 px-3 py-2 text-tiny text-ink-500 line-clamp-2',
                isMine ? 'border-rouge-200' : 'border-moss-400',
              )}
            >
              {quotedMessage.body}
            </div>
          )}
          <p className="text-body text-ink-800 leading-relaxed">{message.body}</p>
          {message.audience === 'family' && isRememberableFamilyFact(message.body) && (
            <div className="mt-3 pt-3 border-t border-paper-200">
              {savedMemory ? (
                <span className="text-tiny text-moss-600 inline-flex items-center gap-1">
                  <BookmarkPlus size={12} />
                  已存进家庭记忆本 · 全家可见
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSaveMemory('family')}
                  className="text-tiny text-rouge-600 hover:text-rouge-700 inline-flex items-center gap-1"
                >
                  <BookmarkPlus size={12} />
                  保存到记忆本
                </button>
              )}
            </div>
          )}
          {message.audience === 'family' && linkedTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-paper-200">
              <div className="space-y-2">
                {linkedTasks.map((task) => (
                  <Link
                    key={task.id}
                    to="/me?view=all"
                    className="block rounded-xl border border-rouge-100 bg-paper px-3 py-2 hover:border-rouge-200"
                  >
                    <div className="text-tiny text-rouge-600">已整理为待接手事项</div>
                    <div className="text-small font-medium text-ink-800 mt-1">{task.title}</div>
                    {task.dueDateText && (
                      <div className="text-tiny text-ink-500 mt-1">时间：{task.dueDateText}</div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {message.audience === 'family' &&
            linkedTasks.length === 0 &&
            isCareRequestCandidate(message.body) && (
              <div className="mt-3 pt-3 border-t border-paper-200">
                <button
                  type="button"
                  onClick={onCreateCareRequest}
                  className="text-tiny text-rouge-600 hover:text-rouge-700 inline-flex items-center gap-1"
                >
                  <Heart size={12} />
                  请家人一起帮忙
                </button>
              </div>
            )}
        </div>
        {message.audience === 'family' && (
          <div className={cn('mt-2 flex gap-2', isMine ? 'justify-end' : 'justify-start')}>
            <button
              type="button"
              onClick={onReply}
              className="text-tiny text-ink-400 hover:text-ink-700 inline-flex items-center gap-1"
            >
              <Reply size={11} />
              回复
            </button>
            <button
              type="button"
              onClick={() => onReact('heart')}
              className={cn(
                'text-tiny inline-flex items-center gap-1',
                hasHeart ? 'text-rouge-600' : 'text-ink-400 hover:text-rouge-600',
              )}
            >
              <Heart size={11} />
              {heartCount > 0 ? heartCount : '抱抱'}
            </button>
            <button
              type="button"
              onClick={() => onReact('seen')}
              className={cn(
                'text-tiny inline-flex items-center gap-1',
                hasSeen ? 'text-moss-600' : 'text-ink-400 hover:text-moss-600',
              )}
            >
              <Check size={11} />
              {seenCount > 0 ? seenCount : '看到了'}
            </button>
          </div>
        )}
      </div>
      {isMine && speaker && <Avatar member={speaker} size={30} />}
    </div>
  )
}

function MemoryShelf({
  memories,
  members,
  currentUserId,
  onSaveMemory,
  onUpdateMemory,
  onRemoveMemory,
  onAsk,
  simple = false,
  fullPage = false,
}: {
  memories: HouseholdMemory[]
  members: FamilyMember[]
  currentUserId: string
  onSaveMemory: (
    text: string,
    createdById?: string,
    sourceMessageId?: string,
    visibility?: HouseholdMemoryVisibility,
    sharedWithIds?: string[],
    photos?: HouseholdMemoryPhoto[],
  ) => void
  onUpdateMemory: (id: string, patch: Partial<HouseholdMemory>) => void
  onRemoveMemory: (id: string) => void
  onAsk: (question: string) => void
  simple?: boolean
  fullPage?: boolean
}) {
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState<HouseholdMemoryVisibility>('family')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editVisibility, setEditVisibility] = useState<HouseholdMemoryVisibility>('family')
  const [editSelectedMembers, setEditSelectedMembers] = useState<string[]>([])
  const [pendingPhotos, setPendingPhotos] = useState<HouseholdMemoryPhoto[]>([])
  const photoRef = useRef<HTMLInputElement>(null)
  const liveAI = hasDeepSeekKey()
  const otherMembers = members.filter((member) => member.id !== currentUserId)
  const shownMemories = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return memories
      .filter(
        (memory) =>
          !needle ||
          `${memory.title} ${memory.detail}`.toLowerCase().includes(needle),
      )
      .slice()
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt - a.createdAt)
  }, [memories, query])

  function saveNote() {
    const cleaned = note.trim()
    if (!cleaned) return
    onSaveMemory(
      cleaned,
      currentUserId,
      undefined,
      visibility,
      visibility === 'selected' ? selectedMembers : undefined,
      pendingPhotos,
    )
    setNote('')
    setVisibility('family')
    setSelectedMembers([])
    setPendingPhotos([])
  }

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const freeSlots = Math.max(0, 3 - pendingPhotos.length)
    const files = Array.from(event.target.files ?? []).slice(0, freeSlots)
    if (files.length === 0) return
    try {
      const photos = await Promise.all(files.map((file) => photoFromFile(file, currentUserId)))
      setPendingPhotos((existing) => [...existing, ...photos])
    } catch {
      // The file remains unadded; the note can still be saved without it.
    }
    if (photoRef.current) photoRef.current.value = ''
  }

  function startEdit(memory: HouseholdMemory) {
    setEditingId(memory.id)
    setEditText(memory.detail)
    setEditVisibility(memory.visibility ?? 'family')
    setEditSelectedMembers(memory.sharedWithIds ?? [])
  }

  function saveEdit(memory: HouseholdMemory) {
    const detail = editText.trim()
    if (!detail) return
    const updatedDraft = draftHouseholdMemory(
      detail,
      memory.createdById,
      memory.sourceMessageId,
      editVisibility,
      editVisibility === 'selected' ? editSelectedMembers : undefined,
    )
    onUpdateMemory(memory.id, {
      ...updatedDraft,
      pinned: memory.pinned,
      confirmedAt: Date.now(),
    })
    setEditingId(null)
  }

  function toggleMember(
    memberId: string,
    chosen: string[],
    setChosen: (next: string[]) => void,
  ) {
    setChosen(
      chosen.includes(memberId)
        ? chosen.filter((id) => id !== memberId)
        : [...chosen, memberId],
    )
  }

  if (simple) {
    return (
      <section className="home-note p-5">
        <div className="eyebrow inline-flex items-center gap-1.5 mb-3">
          <BookOpen size={12} />
          找东西
        </div>
        <p className="text-small text-ink-600 mb-4">想找医药卡或复诊资料，可以点一下问问。</p>
        <div className="space-y-2">
          {ASSISTANT_STARTERS.slice(0, 2).map((question) => (
            <button
              type="button"
              key={question}
              onClick={() => onAsk(question)}
              className="btn-outline w-full justify-center text-small"
            >
              {question}
            </button>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className={cn(fullPage ? 'petal-card p-6 md:p-8' : 'home-note p-5')}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="eyebrow inline-flex items-center gap-1.5">
          <BookOpen size={12} />
          家庭记忆本
        </div>
        <span className="text-tiny text-ink-400">{liveAI ? '本地查找 · AI 可选' : '本地保存'}</span>
      </div>
      <p className="text-tiny text-ink-500 leading-relaxed mb-4">
        保存家人确认过的位置与清单，也可以拍下抽屉或文件袋。之后问欧哈娜时，答案会连同位置照片一起显示。
      </p>
      <p className="rounded-xl bg-honey-50 border border-honey-100 px-3 py-2 text-[11px] text-ink-500 leading-relaxed mb-4">
        位置照片只随家庭记忆保存在当前设备中，不会作为 AI 提问内容发送。
      </p>

      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-2.5 text-ink-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full bg-paper border border-paper-200 focus:border-rouge-300 outline-none pl-8 pr-3 py-2 text-small"
          placeholder="搜位置或清单"
        />
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        className="w-full bg-paper border border-paper-200 focus:border-rouge-300 outline-none resize-none px-3 py-2 text-small mb-2"
        placeholder="如：医药卡在玄关柜第二层蓝色袋子里"
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => void addPhotos(event)}
      />
      <button
        type="button"
        onClick={() => photoRef.current?.click()}
        className="btn-outline text-tiny mb-3"
      >
        <ImageIcon size={12} />
        添加位置照片
      </button>
      {pendingPhotos.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {pendingPhotos.map((photo) => (
            <div key={photo.id} className="relative shrink-0">
              <img
                src={photo.dataUrl}
                alt="待保存的位置照片"
                className="h-20 w-20 rounded-xl object-cover border border-paper-200"
              />
              <button
                type="button"
                onClick={() => setPendingPhotos((current) => current.filter((item) => item.id !== photo.id))}
                aria-label="移除照片"
                className="absolute -right-1 -top-1 rounded-full bg-paper border border-paper-200 p-1 text-ink-500"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <MemoryVisibilityControl
        value={visibility}
        onChange={setVisibility}
        members={otherMembers}
        selectedMembers={selectedMembers}
        onToggleMember={(memberId) =>
          toggleMember(memberId, selectedMembers, setSelectedMembers)
        }
      />
      <button
        type="button"
        onClick={saveNote}
        disabled={!note.trim()}
        className="btn-outline text-tiny w-full justify-center mt-3 mb-5"
      >
        <Plus size={12} />
        保存一条记忆
      </button>

      {shownMemories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-paper-200 px-4 py-5 text-tiny text-ink-500 leading-relaxed">
          {query ? '没有找到相符的记忆。' : '这里还没有内容。把医药卡位置、复诊清单或家中的重要提醒记下来，就能随时问回答案。'}
        </div>
      ) : (
        <ul className="space-y-2 mb-5">
          {shownMemories.map((memory) => (
            <li key={memory.id} className="rounded-2xl bg-paper border border-paper-200 p-3">
              {editingId === memory.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    rows={3}
                    className="w-full bg-paper-50 border border-paper-200 px-3 py-2 text-tiny outline-none focus:border-rouge-300"
                  />
                  <MemoryVisibilityControl
                    value={editVisibility}
                    onChange={setEditVisibility}
                    members={otherMembers}
                    selectedMembers={editSelectedMembers}
                    onToggleMember={(memberId) =>
                      toggleMember(memberId, editSelectedMembers, setEditSelectedMembers)
                    }
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => saveEdit(memory)} className="btn-rouge text-tiny">
                      <Check size={11} />
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="btn-ghost text-tiny">
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-tiny font-medium text-rouge-600 inline-flex items-center gap-1">
                        {memory.pinned && <Pin size={11} />}
                        {memory.title}
                      </div>
                      <div className="text-[11px] text-ink-400 mt-1 inline-flex items-center gap-1">
                        <Shield size={10} />
                        {visibilityLabel(memory.visibility ?? 'family')}
                        <span>· {confirmationLabel(memory.confirmedAt ?? memory.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateMemory(memory.id, { pinned: !memory.pinned })}
                        aria-label={`${memory.pinned ? '取消置顶' : '置顶'} ${memory.title}`}
                        className="text-ink-300 hover:text-rouge-600"
                      >
                        <Pin size={12} />
                      </button>
                      {(memory.createdById === currentUserId || !memory.createdById) && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(memory)}
                            aria-label={`编辑 ${memory.title}`}
                            className="text-ink-300 hover:text-rouge-600"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveMemory(memory.id)}
                            aria-label={`删除 ${memory.title}`}
                            className="text-ink-300 hover:text-ink-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-tiny text-ink-600 leading-relaxed mt-2">{memory.detail}</p>
                  {(memory.photos ?? []).length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {memory.photos?.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.dataUrl}
                          alt={`${memory.title} 的位置照片`}
                          className="h-20 w-20 rounded-xl object-cover border border-paper-200"
                        />
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onUpdateMemory(memory.id, { confirmedAt: Date.now() })}
                    className="mt-2 text-[11px] text-ink-400 hover:text-moss-600"
                  >
                    内容仍正确 · 更新确认日期
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-paper-200 pt-4">
        <div className="text-tiny text-ink-400 mb-2">试着问</div>
        <div className="flex flex-wrap gap-2">
          {ASSISTANT_STARTERS.slice(0, 2).map((question) => (
            <button
              type="button"
              key={question}
              onClick={() => onAsk(question)}
              className="rounded-full border border-paper-200 bg-paper px-3 py-1.5 text-tiny text-ink-600 hover:border-rouge-200"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function MemoryVisibilityControl({
  value,
  onChange,
  members,
  selectedMembers,
  onToggleMember,
}: {
  value: HouseholdMemoryVisibility
  onChange: (value: HouseholdMemoryVisibility) => void
  members: FamilyMember[]
  selectedMembers: string[]
  onToggleMember: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-tiny text-ink-500">
        <Shield size={12} />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as HouseholdMemoryVisibility)}
          className="flex-1 bg-paper border border-paper-200 px-2 py-1.5 outline-none focus:border-rouge-300"
          aria-label="谁能查看这条记忆"
        >
          <option value="family">全家可见</option>
          <option value="selected">指定家人可见</option>
          <option value="private">仅自己可见</option>
        </select>
      </label>
      {value === 'selected' && (
        <div className="flex flex-wrap gap-2 pl-5">
          {members.map((member) => (
            <label key={member.id} className="text-[11px] text-ink-600 inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={selectedMembers.includes(member.id)}
                onChange={() => onToggleMember(member.id)}
                className="accent-rouge-500"
              />
              {member.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function visibilityLabel(visibility: HouseholdMemoryVisibility): string {
  if (visibility === 'private') return '仅自己可见'
  if (visibility === 'selected') return '指定家人可见'
  return '全家可见'
}

function confirmationLabel(timestamp: number): string {
  return `确认于 ${new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(timestamp))}`
}
