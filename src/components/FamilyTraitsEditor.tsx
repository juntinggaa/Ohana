import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const SUGGESTED_TRAITS = [
  '同城父母', '同城唐宁', '可跑腿', '会陪诊', '能买药',
  '能拍照上传', '家务行政', '日历可靠', '可对接师傅',
  '票据整理', '统筹', '在家时间多', '会拍照',
  '了解爸爸状况', '不太会用 App', '只能做简单事',
  '不可承接医疗 / 行政', '已超载', '需要陪诊', '被照护对象',
]

export function FamilyTraitsEditor({
  memberId,
  className,
}: {
  memberId: string
  className?: string
}) {
  const member = useAppStore((s) =>
    s.familyMembers.find((m) => m.id === memberId),
  )
  const addTrait = useAppStore((s) => s.addTrait)
  const removeTrait = useAppStore((s) => s.removeTrait)
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)

  if (!member) return null

  const traits = member.traits ?? []
  const remaining = SUGGESTED_TRAITS.filter((t) => !traits.includes(t))

  function submit() {
    const v = input.trim()
    if (!v) return
    addTrait(memberId, v)
    setInput('')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {traits.length === 0 && (
          <span className="text-tiny text-ink-400 italic mr-1">
            还没有 traits · AI 推荐执行人会缺信息
          </span>
        )}
        {traits.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-tiny bg-paper-100 border border-ink-200 px-2 py-0.5 text-ink-700"
          >
            {t}
            <button
              onClick={() => removeTrait(memberId, t)}
              className="text-ink-400 hover:text-rouge-500"
              aria-label={`移除 ${t}`}
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-tiny text-ink-500 hover:text-ink-900 border border-dashed border-ink-300 px-2 py-0.5 hover:border-ink-700"
        >
          <Plus size={9} className="inline-block -mt-px" /> 加 trait
        </button>
      </div>

      {open && (
        <div className="border border-ink-200 bg-paper-50 p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              className="flex-1 bg-paper border border-ink-300 px-2 py-1 text-tiny focus:border-ink-700 outline-none"
              placeholder="例如：会拍照 / 同城父母 / 日历可靠"
            />
            <button onClick={submit} className="btn-outline text-tiny">
              加
            </button>
          </div>
          {remaining.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-tiny text-ink-400 self-center">建议：</span>
              {remaining.slice(0, 10).map((t) => (
                <button
                  key={t}
                  onClick={() => addTrait(memberId, t)}
                  className="text-tiny px-2 py-0.5 border border-ink-200 text-ink-600 hover:border-ink-700"
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
