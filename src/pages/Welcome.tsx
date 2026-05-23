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

export function WelcomePage() {
  const navigate = useNavigate()
  const setFamily = useAppStore((s) => s.setFamily)
  const dismissWelcome = useAppStore((s) => s.dismissWelcome)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)
  const resetToSampleData = useAppStore((s) => s.resetToSampleData)
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
    }))
    setFamily(members)
    setCurrentUser(me.isMe ? 'me' : members[0].id)
    dismissWelcome()
    pushToast(`欢迎，${me.name} · 你的家庭已建好`, 'success')
    navigate('/inbox')
  }

  function useSampleFamily() {
    resetToSampleData()
    dismissWelcome()
    pushToast('已载入示例家庭（唐宁家） · 你可以在「家庭」页改成自己的', 'info')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-8 py-16">
        <header className="mb-12">
          <div className="eyebrow mb-4">欢迎</div>
          <h1 className="font-serif text-h1 text-ink-900 leading-tight">
            先把你的家放进来。
          </h1>
          <p className="mt-4 text-lead text-ink-600 max-w-xl">
            欧哈娜只看你愿意告诉它的事 —— 哪些人、在哪、平时是不是有空。
            <br />
            <span className="text-tiny text-ink-500">
              数据只存在你的浏览器，不会上传到任何地方。
            </span>
          </p>
        </header>

        <div className="space-y-3 mb-8">
          {drafts.map((d, idx) => (
            <div key={d.id} className="border border-ink-200 bg-paper-50 p-4">
              <div className="flex items-baseline justify-between mb-3">
                <div className="text-tiny text-ink-500">
                  {d.isMe ? '主用户（你）' : `家人 ${idx}`}
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
                    className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                    placeholder={d.isMe ? '你的名字' : '例如：妈妈 / 弟弟 / 周勉'}
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
                    className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                  >
                    {RELATION_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="所在城市 (选填)">
                  <input
                    type="text"
                    value={d.city}
                    onChange={(e) => update(d.id, { city: e.target.value })}
                    className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                    placeholder="同你 / 上海 / 南京 ..."
                  />
                </Field>
                <Field label="时间情况 (选填)">
                  <select
                    value={d.capacity}
                    onChange={(e) => update(d.id, { capacity: e.target.value as CapacityTag })}
                    className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                  >
                    <option value="">未指定</option>
                    <option value="busy">工作日很忙</option>
                    <option value="medium">中等</option>
                    <option value="flexible">在家时间多 / 退休</option>
                  </select>
                </Field>
                <Field label="备注 (选填)" className="md:col-span-2">
                  <input
                    type="text"
                    value={d.notes}
                    onChange={(e) => update(d.id, { notes: e.target.value })}
                    className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                    placeholder="例如：高血压 · 不爱发消息 · 常说没事"
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

        <div className="border-t border-ink-200 pt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <button onClick={useSampleFamily} className="btn-ghost">
            <Sparkles size={12} />
            先用示例（唐宁家）演示
          </button>
          <button onClick={finish} className={cn('btn-rouge')}>
            建好了，开始用
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="mt-12 text-tiny text-ink-500 leading-relaxed border-t border-ink-200 pt-6">
          <strong className="text-ink-700">说明：</strong>
          欧哈娜的 AI 用你提供的城市 + 时间情况，去推荐每件事谁来做更合适。
          比如药品补货优先派给和老人同城的人；学校手工优先派给在家时间多的人。
          你随时可以在 /family 页改成员信息，或在 /settings 重置。
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
