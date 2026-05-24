import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, ArrowRight, Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { CapacityTag } from '@/lib/types'

interface DraftMember {
  id: string
  name: string
  relation: string
  city: string
  capacity: CapacityTag | ''
  notes: string
  isMe: boolean
}

const RELATION_OPTIONS = ['我自己', '伴侣', '妈妈', '爸爸', '弟弟', '妹妹', '哥哥', '姐姐', '孩子', '其他']

const COLOR_POOL = [
  'bg-rouge-500 text-paper',
  'bg-ink-800 text-paper',
  'bg-moss-500 text-paper',
  'bg-ink-500 text-paper',
  'bg-rouge-200 text-ink-900',
  'bg-moss-400 text-paper',
  'bg-ink-400 text-paper',
]

function newDraftId() {
  return `d-${Math.random().toString(36).slice(2, 8)}`
}

function inferTraits(d: DraftMember): string[] {
  const traits = new Set<string>()
  if (d.capacity === 'flexible') traits.add('时间灵活')
  if (d.capacity === 'medium') traits.add('可协调时间')
  if (/伴侣|丈夫|妻子|老公|老婆/.test(d.relation)) {
    traits.add('会打理家中安排')
    traits.add('会记住重要日子')
  }
  if (/弟弟|妹妹|哥哥|姐姐/.test(d.relation)) {
    traits.add('方便帮忙跑一趟')
  }
  if (/妈妈|爸爸|母亲|父亲/.test(d.relation)) {
    traits.add('熟悉家里近况')
    traits.add('会分享照片')
  }
  if (/孩子|儿子|女儿/.test(d.relation)) {
    traits.add('适合轻松的小事')
  }
  return Array.from(traits)
}

export function WelcomePage() {
  const navigate = useNavigate()
  const setFamily = useAppStore((s) => s.setFamily)
  const dismissWelcome = useAppStore((s) => s.dismissWelcome)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const resetToSampleData = useAppStore((s) => s.resetToSampleData)
  const clearAll = useAppStore((s) => s.clearAll)
  const pushToast = useAppStore((s) => s.pushToast)

  const [drafts, setDrafts] = useState<DraftMember[]>([
    {
      id: newDraftId(),
      name: '',
      relation: '我自己',
      city: '',
      capacity: 'busy',
      notes: '',
      isMe: true,
    },
    {
      id: newDraftId(),
      name: '',
      relation: '妈妈',
      city: '',
      capacity: 'flexible',
      notes: '',
      isMe: false,
    },
  ])

  function update(id: string, patch: Partial<DraftMember>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function add() {
    setDrafts((ds) => [
      ...ds,
      {
        id: newDraftId(),
        name: '',
        relation: '伴侣',
        city: '',
        capacity: 'medium',
        notes: '',
        isMe: false,
      },
    ])
  }

  function remove(id: string) {
    setDrafts((ds) => ds.filter((d) => d.id !== id))
  }

  function finish() {
    const ready = drafts.filter((d) => d.name.trim().length > 0)
    if (ready.length === 0) {
      pushToast('至少填一个人的名字', 'warn')
      return
    }
    const me = ready.find((d) => d.isMe) ?? ready[0]
    const members = ready.map((d, idx) => ({
      id: d.isMe ? 'me' : `mem-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: d.name.trim(),
      relation: d.relation,
      avatarColor: COLOR_POOL[idx % COLOR_POOL.length],
      city: d.city.trim() || undefined,
      capacity: (d.capacity || undefined) as CapacityTag | undefined,
      notes: d.notes.trim() || undefined,
      traits: inferTraits(d),
    }))
    // 用户填了自己的家 · 先清掉示例任务/通知/家庭记忆，从一张白纸开始
    clearAll()
    setFamily(members)
    setCurrentUser(me.isMe ? 'me' : members[0].id)
    dismissWelcome()
    pushToast(`欢迎回家，${me.name} · 先留下一句近况吧`, 'success')
    navigate('/memory')
  }

  function useSampleFamily() {
    resetToSampleData()
    dismissWelcome()
    pushToast('已打开唐宁家的示例 · 看看如何把牵挂接住', 'info')
    navigate('/memory?mode=paste')
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute -top-28 -right-28 w-80 h-80 rounded-full bg-rouge-100/55 blur-3xl" />
      <div className="absolute bottom-16 -left-20 w-72 h-72 rounded-full bg-honey-100/55 blur-3xl" />
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-16 relative">
        <header className="mb-12">
          <div className="eyebrow mb-4">欢迎回家</div>
          <h1 className="font-serif text-h1 md:text-display text-ink-900 leading-tight">
            把牵挂的人，<br className="hidden sm:block" />轻轻放在一起。
          </h1>
          <p className="mt-5 text-lead text-ink-600 max-w-xl leading-relaxed">
            欧哈娜帮家人记住近况、问候与需要搭把手的小事。
            先告诉我们家里有谁，之后一句话就能把关心留下来。
          </p>
          <p className="mt-4 inline-flex rounded-full bg-paper-50 border border-paper-200 px-4 py-2 text-tiny text-ink-500 shadow-soft">
            你的家庭资料只留在当前浏览器里
          </p>
        </header>

        <div className="space-y-4 mb-8">
          {drafts.map((d, idx) => (
            <div key={d.id} className="petal-card p-5 md:p-6">
              <div className="flex items-baseline justify-between mb-3">
                <div className="eyebrow">
                  {d.isMe ? '从你开始' : `家人 ${idx}`}
                </div>
                {!d.isMe && (
                  <button
                    onClick={() => remove(d.id)}
                    className="text-ink-400 hover:text-rouge-500 text-tiny inline-flex items-center gap-1"
                  >
                    <X size={10} />
                    删除
                  </button>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="名字 / 称呼">
                  <input
                    type="text"
                    value={d.name}
                    onChange={(e) => update(d.id, { name: e.target.value })}
                    className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                    placeholder={d.isMe ? '你的名字' : '例如：妈妈 / 弟弟 / 伴侣'}
                  />
                </Field>
                <Field label="关系">
                  <select
                    value={d.relation}
                    onChange={(e) =>
                      update(d.id, {
                        relation: e.target.value,
                        isMe: e.target.value === '我自己',
                      })
                    }
                    className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                  >
                    {RELATION_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="现在生活在哪里 (选填)">
                  <input
                    type="text"
                    value={d.city}
                    onChange={(e) => update(d.id, { city: e.target.value })}
                    className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                    placeholder="同你 / 上海 / 南京 ..."
                  />
                </Field>
                <Field label="最近的生活节奏 (选填)">
                  <select
                    value={d.capacity}
                    onChange={(e) => update(d.id, { capacity: e.target.value as CapacityTag })}
                    className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                  >
                    <option value="">未指定</option>
                    <option value="busy">最近比较忙，也需要被照顾</option>
                    <option value="medium">平常节奏</option>
                    <option value="flexible">最近比较有余裕</option>
                  </select>
                </Field>
                <Field label="想让家人记得的事 (选填)" className="md:col-span-2">
                  <input
                    type="text"
                    value={d.notes}
                    onChange={(e) => update(d.id, { notes: e.target.value })}
                    className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                    placeholder="例如：最近在复诊 · 不太爱发消息 · 喜欢周末电话"
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <button onClick={add} className="btn-outline mb-12 w-full md:w-auto">
          <Plus size={14} />
          再加一个家人
        </button>

        <div className="border-t border-paper-200 pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <button onClick={useSampleFamily} className="btn-ghost">
            <Sparkles size={12} />
            先看看一个家庭示例
          </button>
          <button onClick={finish} className={cn('btn-rouge')}>
            一起回家看看
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="mt-12 text-small text-ink-500 leading-relaxed rounded-2xl bg-honey-50 border border-honey-100 p-5">
          <strong className="text-ink-700">为什么问城市和节奏？</strong>
          <span className="block mt-1">
            当家里真的需要陪诊、取药或接孩子时，欧哈娜才能温柔地建议谁比较方便搭把手，不让关心总落在一个人身上。
          </span>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="text-tiny text-ink-500 block mb-1">{label}</span>
      {children}
    </label>
  )
}
