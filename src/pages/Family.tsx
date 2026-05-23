import { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Avatar } from '@/components/Avatar'
import { FamilyTraitsEditor } from '@/components/FamilyTraitsEditor'
import { useAppStore } from '@/lib/store'
import type { CapacityTag, FamilyMember } from '@/lib/types'
import { cn, formatPercent } from '@/lib/utils'

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

const CAPACITY_LABEL: Record<CapacityTag, string> = {
  busy: '工作日很忙',
  medium: '中等',
  flexible: '在家时间多 / 退休',
}

export function FamilyPage() {
  const members = useAppStore((s) => s.familyMembers)
  const tasks = useAppStore((s) => s.tasks)
  const accepted = useAppStore((s) => s.accepted)
  const mentalLoad = useAppStore((s) => s.mentalLoadAfter)
  const addFamilyMember = useAppStore((s) => s.addFamilyMember)
  const updateFamilyMember = useAppStore((s) => s.updateFamilyMember)
  const removeFamilyMember = useAppStore((s) => s.removeFamilyMember)
  const pushToast = useAppStore((s) => s.pushToast)

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<FamilyMember>>({})

  function startEdit(m: FamilyMember) {
    setEditing(m.id)
    setDraft({ ...m })
  }

  function saveEdit() {
    if (!editing) return
    if (!draft.name?.trim()) {
      pushToast('名字不能空', 'warn')
      return
    }
    updateFamilyMember(editing, draft)
    setEditing(null)
    setDraft({})
    pushToast('已保存', 'success')
  }

  function cancelEdit() {
    setEditing(null)
    setDraft({})
  }

  function addNew() {
    const id = addFamilyMember({
      name: '新成员',
      relation: '其他',
      avatarColor: COLOR_POOL[members.length % COLOR_POOL.length],
      capacity: 'medium',
    })
    const created = members.find((m) => m.id === id) ?? {
      id,
      name: '新成员',
      relation: '其他',
      avatarColor: COLOR_POOL[members.length % COLOR_POOL.length],
    }
    startEdit(created as FamilyMember)
  }

  function handleRemove(m: FamilyMember) {
    if (m.id === 'tangning') {
      pushToast('唐宁是主用户，不能删除', 'warn')
      return
    }
    if (confirm(`确定删除 ${m.name}？相关任务的指派会变成空。`)) {
      removeFamilyMember(m.id)
      pushToast(`${m.name} 已移出家庭`, 'info')
    }
  }

  return (
    <>
      <PageHeader
        title="家庭"
        description={`${members.length} 个成员 · 点任意一行编辑`}
        actions={
          <button onClick={addNew} className="btn-rouge">
            <Plus size={14} />
            加家人
          </button>
        }
      />

      <div className="max-w-6xl mx-auto px-8 lg:px-12 pb-20">
        <div className="border-t border-ink-200 pt-6 space-y-0">
          {members.map((m) => {
            const memberTasks = tasks.filter(
              (t) => t.executorId === m.id || t.suggestedOwnerId === m.id,
            )
            const acceptedHere = Object.values(accepted).filter((a) => a.ownerId === m.id).length
            const load = mentalLoad.find((e) => e.memberId === m.id)
            const isEditing = editing === m.id

            if (isEditing) {
              return (
                <div
                  key={m.id}
                  className="border-b border-ink-200 py-5 bg-paper-100 -mx-4 px-4"
                >
                  <div className="eyebrow mb-3 text-rouge-500">编辑成员</div>
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    <Field label="名字">
                      <input
                        type="text"
                        value={draft.name ?? ''}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                      />
                    </Field>
                    <Field label="关系">
                      <select
                        value={draft.relation ?? ''}
                        onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
                        className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                      >
                        {RELATION_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="所在城市">
                      <input
                        type="text"
                        value={draft.city ?? ''}
                        onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                        className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                        placeholder="同你 / 上海 / 南京 ..."
                      />
                    </Field>
                    <Field label="时间情况">
                      <select
                        value={draft.capacity ?? ''}
                        onChange={(e) =>
                          setDraft({ ...draft, capacity: e.target.value as CapacityTag })
                        }
                        className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                      >
                        <option value="">未指定</option>
                        <option value="busy">工作日很忙</option>
                        <option value="medium">中等</option>
                        <option value="flexible">在家时间多 / 退休</option>
                      </select>
                    </Field>
                    <Field label="备注" className="md:col-span-2">
                      <input
                        type="text"
                        value={draft.notes ?? ''}
                        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        className="w-full bg-paper border border-ink-300 px-3 py-2 text-body focus:border-ink-700 outline-none"
                        placeholder="例如：高血压 · 不爱发消息"
                      />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={saveEdit} className="btn-rouge">
                      <Check size={12} />
                      保存
                    </button>
                    <button onClick={cancelEdit} className="btn-ghost">
                      取消
                    </button>
                    {m.id !== 'tangning' && (
                      <button
                        onClick={() => {
                          handleRemove(m)
                          setEditing(null)
                        }}
                        className="ml-auto text-tiny text-ink-400 hover:text-rouge-500 inline-flex items-center gap-1"
                      >
                        <X size={10} />
                        移出家庭
                      </button>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={m.id}
                className="border-b border-ink-200 py-5 grid grid-cols-1 md:grid-cols-[200px_1fr_120px] gap-6 items-start hover:bg-paper-50 transition"
              >
                <button
                  onClick={() => startEdit(m)}
                  className="flex items-center gap-3 text-left"
                >
                  <Avatar member={m} size={40} />
                  <div>
                    <div className="font-serif text-h3 text-ink-900 leading-none">{m.name}</div>
                    <div className="text-tiny text-ink-500 mt-1">
                      {m.relation}
                      {m.city && ` · ${m.city}`}
                      {m.capacity && ` · ${CAPACITY_LABEL[m.capacity]}`}
                    </div>
                  </div>
                </button>
                <div className="text-small text-ink-600 leading-relaxed space-y-3">
                  <div>
                    {m.notes || (
                      <span className="text-ink-400 italic">无备注 · 点头像编辑</span>
                    )}
                  </div>
                  <FamilyTraitsEditor memberId={m.id} />
                  {memberTasks.length > 0 && (
                    <div className="text-tiny text-ink-500 flex flex-wrap gap-3">
                      <span className="text-rouge-500">{memberTasks.length} 条相关任务</span>
                      {acceptedHere > 0 && (
                        <span className="text-moss-500">已承接 {acceptedHere} 条</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {load && load.score > 0 && (
                    <>
                      <div className="eyebrow text-ink-400 mb-1">本周心智</div>
                      <div
                        className={cn(
                          'num text-h3 leading-none',
                          m.id === 'tangning' && load.percentage > 0.5
                            ? 'text-rouge-500'
                            : 'text-ink-900',
                        )}
                      >
                        {formatPercent(load.percentage)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 text-tiny text-ink-500">
          💡 越多关于家人的信息（城市 / 时间情况 / traits），AI 推荐执行人就越准。
          traits 像是「同城父母 / 会陪诊 / 已超载」这种短语，影响每条任务该派给谁。
        </div>
      </div>
    </>
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
