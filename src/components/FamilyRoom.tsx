import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  BookOpen,
  BookmarkPlus,
  Bot,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Avatar } from './Avatar'
import { useAppStore } from '@/lib/store'
import {
  answerFromHouseholdMemory,
  draftHouseholdMemory,
  isRememberableFamilyFact,
} from '@/lib/agents/familyConversationAgent'
import { hasDeepSeekKey } from '@/lib/llm/llmClient'
import { newId } from '@/lib/utilsId'
import { cn } from '@/lib/utils'
import type { FamilyChatAudience, FamilyChatMessage, HouseholdMemory } from '@/lib/types'

const FAMILY_STARTERS = [
  '今天大家都好吗？',
  '我今天有件开心的小事想分享：',
  '今晚想给大家打个电话。',
  '请记住：医药卡放在玄关柜第二层的蓝色文件袋里。',
]

const ASSISTANT_STARTERS = [
  '医药卡在哪里？',
  '爸爸复诊要带什么？',
  '家里记过药盒放在哪里吗？',
]

interface Props {
  initialText?: string
  initialAudience?: FamilyChatAudience
  isElder?: boolean
}

export function FamilyRoom({
  initialText = '',
  initialAudience = 'family',
  isElder = false,
}: Props) {
  const members = useAppStore((s) => s.familyMembers)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const messages = useAppStore((s) => s.familyChatMessages)
  const memories = useAppStore((s) => s.householdMemories)
  const pushMessage = useAppStore((s) => s.pushFamilyChatMessage)
  const addMemory = useAppStore((s) => s.addHouseholdMemory)
  const removeMemory = useAppStore((s) => s.removeHouseholdMemory)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const pushToast = useAppStore((s) => s.pushToast)

  const [audience, setAudience] = useState<FamilyChatAudience>(initialAudience)
  const [text, setText] = useState(initialText)
  const [answering, setAnswering] = useState(false)
  const [allowRemoteAI, setAllowRemoteAI] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)

  const me = useMemo(
    () => members.find((member) => member.id === currentUserId) ?? members[0],
    [members, currentUserId],
  )

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length, answering])

  function saveMemory(
    raw: string,
    createdById?: string,
    sourceMessageId?: string,
  ) {
    const memory = addMemory(draftHouseholdMemory(raw, createdById, sourceMessageId))
    pushToast(`已记在家庭记忆本：${memory.title}`, 'success')
  }

  async function handleSend(value?: string, target: FamilyChatAudience = audience) {
    const raw = (value ?? text).trim()
    if (!raw || answering) return

    const message: FamilyChatMessage = {
      id: newId('chat'),
      role: 'family',
      speakerId: currentUserId,
      audience: target,
      body: raw,
      createdAt: Date.now(),
    }
    pushMessage(message)
    setText('')

    if (target === 'family') return

    setAnswering(true)
    const result = await answerFromHouseholdMemory({
      question: raw,
      memories,
      useRemoteAI: allowRemoteAI && hasDeepSeekKey(),
    })
    pushMessage({
      id: newId('chat'),
      role: 'assistant',
      audience: 'assistant',
      body: result.data.text,
      memoryIds: result.data.memoryIds,
      createdAt: Date.now(),
    })
    setAnswering(false)
  }

  function handleVoice() {
    pushToast('语音功能还在准备中，先为你填好一句话。', 'info')
    setAudience('family')
    setText('今天大家都好吗？我想听听你们的近况。')
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    pushToast(`图片 ${file.name} 已收到，之后可以把照片记进家庭相册。`, 'info')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div
      className={cn(
        'max-w-6xl mx-auto px-6 lg:px-12 pb-20 grid gap-6',
        isElder ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_320px]',
      )}
    >
      <section className="petal-card overflow-hidden flex flex-col min-h-[620px]">
        <div className="px-5 md:px-7 py-5 border-b border-paper-200 bg-paper-50/70 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-h3 text-ink-900">家庭聊天</h2>
            <p className="text-tiny text-ink-500 mt-1">每句留言都会留在这个家里，不会自动变成待办。</p>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 text-tiny text-moss-600 bg-moss-50 rounded-full px-3 py-1.5">
            <MessageCircle size={12} />
            家人可继续回复
          </div>
        </div>

        <div ref={conversationRef} className="flex-1 min-h-[300px] max-h-[560px] overflow-y-auto px-5 md:px-7 py-6">
          {messages.length === 0 ? (
            <div className="h-full min-h-[260px] rounded-3xl bg-honey-50 border border-honey-100 p-7 flex flex-col justify-center">
              <Sparkles size={20} className="text-rouge-500 mb-4" />
              <h3 className="font-serif text-h3 text-ink-900">从一句普通的话开始</h3>
              <p className="text-small text-ink-600 leading-relaxed mt-3 max-w-md">
                问声好、分享小开心，或告诉家人一件想记住的事。只有你主动问欧哈娜时，它才会查找家庭记忆回答。
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <FamilyMessageBubble
                  key={message.id}
                  message={message}
                  memories={memories}
                  onSaveMemory={() => saveMemory(message.body, message.speakerId, message.id)}
                />
              ))}
              {answering && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-honey-100 text-rouge-500 grid place-items-center">
                    <Bot size={15} />
                  </div>
                  <div className="rounded-2xl rounded-tl-md bg-honey-50 border border-honey-100 px-4 py-3 text-small text-ink-500">
                    正在翻翻家中的记忆...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-paper-200 bg-paper-50/55 px-5 md:px-7 py-5">
          <div className="segmented mb-4 w-fit">
            <button
              type="button"
              onClick={() => setAudience('family')}
              className={cn('segment', audience === 'family' && 'segment-active')}
            >
              <MessageCircle size={12} />
              发给家人
            </button>
            <button
              type="button"
              onClick={() => setAudience('assistant')}
              className={cn('segment', audience === 'assistant' && 'segment-active')}
            >
              <Bot size={12} />
              问欧哈娜
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(audience === 'family' ? FAMILY_STARTERS : ASSISTANT_STARTERS).map((prompt) => (
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

          {audience === 'assistant' && hasDeepSeekKey() && (
            <label className="mb-4 flex items-start gap-2 rounded-2xl bg-honey-50 border border-honey-100 px-3 py-2.5 text-tiny text-ink-600">
              <input
                type="checkbox"
                checked={allowRemoteAI}
                onChange={(event) => setAllowRemoteAI(event.target.checked)}
                className="mt-0.5 accent-rouge-500"
              />
              <span>
                让 AI 补充回答
                <span className="block text-ink-400 mt-0.5">
                  开启后会把这次问题和匹配到的家庭记忆发送到 OpenRouter。
                </span>
              </span>
            </label>
          )}

          <div className="flex items-start gap-3">
            {me && <Avatar member={me} size={36} />}
            <div className="flex-1 min-w-0">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={isElder ? 4 : 3}
                className="w-full bg-paper border border-paper-200 focus:border-rouge-300 outline-none resize-none px-4 py-3 text-body"
                placeholder={
                  audience === 'family'
                    ? '例如：今天大家都好吗？我有一件开心的小事想分享。'
                    : '例如：医药卡在哪里？复诊要带什么？'
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
                  语音
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
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="btn-outline text-tiny"
                    >
                      <ImageIcon size={12} />
                      照片
                    </button>
                  </>
                )}
                <span className="ml-auto text-tiny text-ink-400">Ctrl / Cmd + Enter</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-5 lg:self-start">
        <MemoryShelf
          memories={memories}
          currentUserId={currentUserId}
          onSaveMemory={saveMemory}
          onRemoveMemory={removeMemory}
          onAsk={(question) => {
            setAudience('assistant')
            setText(question)
          }}
        />

        {!isElder && (
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
  memories,
  onSaveMemory,
}: {
  message: FamilyChatMessage
  memories: HouseholdMemory[]
  onSaveMemory: () => void
}) {
  const speaker = useAppStore((s) =>
    message.speakerId
      ? s.familyMembers.find((member) => member.id === message.speakerId)
      : undefined,
  )
  const cited = memories.filter((memory) => message.memoryIds?.includes(memory.id))
  const alreadySaved = memories.some((memory) => memory.sourceMessageId === message.id)

  if (message.role === 'assistant') {
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-honey-100 text-rouge-500 grid place-items-center shrink-0">
          <Bot size={15} />
        </div>
        <div className="min-w-0 max-w-[92%]">
          <div className="text-tiny text-rouge-500 mb-1">欧哈娜 · 查找家中记忆</div>
          <div className="rounded-2xl rounded-tl-md bg-honey-50 border border-honey-100 px-4 py-3">
            <p className="text-body text-ink-800 leading-relaxed">{message.body}</p>
            {cited.length > 0 && (
              <div className="mt-3 pt-3 border-t border-honey-100 flex flex-wrap gap-2">
                {cited.map((memory) => (
                  <span key={memory.id} className="rounded-full bg-paper px-2.5 py-1 text-tiny text-ink-500">
                    来源：{memory.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-end gap-3">
      <div className="min-w-0 max-w-[88%] text-right">
        <div className="text-tiny text-ink-500 mb-1">
          {speaker?.name ?? '家人'}
          {message.audience === 'assistant' ? ' · 问欧哈娜' : ' · 发给家人'}
        </div>
        <div className="rounded-2xl rounded-tr-md bg-paper border border-paper-200 px-4 py-3 text-left">
          <p className="text-body text-ink-800 leading-relaxed">{message.body}</p>
          {message.audience === 'family' && isRememberableFamilyFact(message.body) && (
            <div className="mt-3 pt-3 border-t border-paper-200">
              {alreadySaved ? (
                <span className="text-tiny text-moss-600 inline-flex items-center gap-1">
                  <BookmarkPlus size={12} />
                  已存进家庭记忆本
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onSaveMemory}
                  className="text-tiny text-rouge-600 hover:text-rouge-700 inline-flex items-center gap-1"
                >
                  <BookmarkPlus size={12} />
                  把这件事记进记忆本
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {speaker && <Avatar member={speaker} size={30} />}
    </div>
  )
}

function MemoryShelf({
  memories,
  currentUserId,
  onSaveMemory,
  onRemoveMemory,
  onAsk,
}: {
  memories: HouseholdMemory[]
  currentUserId: string
  onSaveMemory: (text: string, createdById?: string) => void
  onRemoveMemory: (id: string) => void
  onAsk: (question: string) => void
}) {
  const [note, setNote] = useState('')
  const liveAI = hasDeepSeekKey()

  function saveNote() {
    const cleaned = note.trim()
    if (!cleaned) return
    onSaveMemory(cleaned, currentUserId)
    setNote('')
  }

  return (
    <section className="home-note p-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="eyebrow inline-flex items-center gap-1.5">
          <BookOpen size={12} />
          家庭记忆本
        </div>
        <span className="text-tiny text-ink-400">{liveAI ? '本地查找 · AI 可选' : '本地保存'}</span>
      </div>
      <p className="text-tiny text-ink-500 leading-relaxed mb-4">
        保存家人确认过的位置与清单。欧哈娜只会把这里记过的家庭事实找回来。
      </p>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        className="w-full bg-paper border border-paper-200 focus:border-rouge-300 outline-none resize-none px-3 py-2 text-small mb-2"
        placeholder="如：医药卡放在玄关柜第二层蓝色袋子里"
      />
      <button
        type="button"
        onClick={saveNote}
        disabled={!note.trim()}
        className="btn-outline text-tiny w-full justify-center mb-5"
      >
        <Plus size={12} />
        保存一条记忆
      </button>

      {memories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-paper-200 px-4 py-5 text-tiny text-ink-500 leading-relaxed">
          这里还没有内容。把医药卡位置、复诊清单或家中的重要提醒记下来，就能随时问回答案。
        </div>
      ) : (
        <ul className="space-y-2 mb-5">
          {memories.map((memory) => (
            <li key={memory.id} className="rounded-2xl bg-paper border border-paper-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-tiny font-medium text-rouge-600">{memory.title}</div>
                <button
                  type="button"
                  onClick={() => onRemoveMemory(memory.id)}
                  aria-label={`删除 ${memory.title}`}
                  className="text-ink-300 hover:text-ink-600 shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-tiny text-ink-600 leading-relaxed mt-1">{memory.detail}</p>
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
