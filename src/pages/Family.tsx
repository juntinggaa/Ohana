import { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Avatar } from '@/components/Avatar'
import { FamilyTraitsEditor } from '@/components/FamilyTraitsEditor'
import { useAppStore } from '@/lib/store'
import { taskAssigneeIds } from '@/lib/status'
import type { CapacityTag, FamilyMember } from '@/lib/types'
import { cn } from '@/lib/utils'

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
  busy: '最近比较忙',
  medium: '平常节奏',
  flexible: '最近有些余裕',
}

export function FamilyPage() {
  const members = useAppStore((s) => s.familyMembers)
  const currentUserId = useAppStore((s) => s.currentUserId)
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
    if (members.length <= 1) {
      pushToast('至少保留一个家人', 'warn')
      return
    }
    if (m.id === currentUserId) {
      pushToast('不能删除当前正在使用的身份，请先切换到另一个家人', 'warn')
      return
    }
    if (confirm(`确定移出 ${m.name}？与 ta 有关的照应提醒将需要重新安排。`)) {
      removeFamilyMember(m.id)
      pushToast(`${m.name} 已移出家庭`, 'info')
    }
  }

  return (
    <>
      <PageHeader
        title="家人小档案"
        description={`${members.length} 位家人 · 记下彼此的生活节奏和需要关心的事`}
        actions={
          <button onClick={addNew} className="btn-rouge">
            <Plus size={14} />
            加家人
          </button>
        }
      />

      <div className="max-w-6xl mx-auto px-6 lg:px-12 pb-20">
        <div className="space-y-4">
          {members.map((m) => {
            const memberTasks = tasks.filter(
              (t) =>
                taskAssigneeIds(t).includes(m.id) ||
                t.suggestedOwnerId === m.id ||
                t.subtasks.some((sub) => sub.suggestedOwnerId === m.id),
            )
            const acceptedHere = Object.values(accepted).filter((a) => a.ownerId === m.id).length
            const load = mentalLoad.find((e) => e.memberId === m.id)
            const isEditing = editing === m.id

            if (isEditing) {
              return (
                <div
                  key={m.id}
                  className="petal-card p-5 md:p-6"
                >
                  <div className="eyebrow mb-3">写下家人的近况</div>
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    <Field label="名字">
                      <input
                        type="text"
                        value={draft.name ?? ''}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                      />
                    </Field>
                    <Field label="关系">
                      <select
                        value={draft.relation ?? ''}
                        onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
                        className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                      >
                        {RELATION_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="现在生活在哪里">
                      <input
                        type="text"
                        value={draft.city ?? ''}
                        onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                        className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                        placeholder="同你 / 上海 / 南京 ..."
                      />
                    </Field>
                    <Field label="最近的生活节奏">
                      <select
                        value={draft.capacity ?? ''}
                        onChange={(e) =>
                          setDraft({ ...draft, capacity: e.target.value as CapacityTag })
                        }
                        className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                      >
                        <option value="">未指定</option>
                        <option value="busy">最近比较忙，也需要被照顾</option>
                        <option value="medium">平常节奏</option>
                        <option value="flexible">最近比较有余裕</option>
                      </select>
                    </Field>
                    <Field label="想让家人记得的事" className="md:col-span-2">
                      <input
                        type="text"
                        value={draft.notes ?? ''}
                        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        className="w-full bg-paper border border-paper-200 px-3 py-2 text-body focus:border-rouge-300 outline-none"
                        placeholder="例如：最近在复诊 · 喜欢周末电话"
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
                    {members.length > 1 && m.id !== currentUserId && (
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
                className="home-note grid grid-cols-1 md:grid-cols-[210px_1fr_150px] gap-6 items-start transition hover:border-rouge-100"
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
                      <span className="text-rouge-500">{memberTasks.length} 件正在牵挂</span>
                      {acceptedHere > 0 && (
                        <span className="text-moss-500">正在照看 {acceptedHere} 件</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {load && load.score > 0 && (
                    <>
                      <div className="eyebrow mb-1">本周感受</div>
                      <div className={cn('text-small leading-relaxed', load.percentage > 0.5 ? 'text-rouge-600' : 'text-moss-600')}>
                        {load.percentage > 0.5 ? '最近操心较多' : '在照应家里'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-7 rounded-2xl bg-honey-50 border border-honey-100 px-5 py-4 text-small text-ink-600 leading-relaxed">
          写下所在城市、最近节奏和擅长的小事，是为了在真正需要帮助时找到方便的人，也让最近疲惫的家人少承担一点。
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
