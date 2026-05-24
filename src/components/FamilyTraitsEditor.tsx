import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const SUGGESTED_TRAITS = [
  '和长辈同城', '和孩子同城', '方便到家里', '方便帮忙跑一趟', '愿意陪诊', '方便买药',
  '会分享照片', '会打理家中安排', '会记住重要日子', '方便接待师傅',
  '会整理票据', '善于统筹', '时间灵活',
  '熟悉家里近况', '不太会用 App', '适合轻松的小事',
  '最近需要休息', '需要陪诊', '正在被照顾',
]

const DISPLAY_LABEL: Record<string, string> = {
  '同城老人': '和长辈同城',
  '同城父母': '和父母同城',
  '同城孩子': '和孩子同城',
  '同城家中': '方便到家里',
  '可跑腿': '方便帮忙跑一趟',
  '会陪诊': '愿意陪诊',
  '能买药': '方便买药',
  '能拍照上传': '会分享照片',
  '会拍照': '会分享照片',
  '家务行政': '会打理家中安排',
  '日历可靠': '会记住重要日子',
  '可对接师傅': '方便接待师傅',
  '票据整理': '会整理票据',
  '统筹': '善于统筹',
  '了解家里状况': '熟悉家里近况',
  '已超载': '最近需要休息',
  '只能做简单事': '适合轻松的小事',
  '不可承接医疗 / 行政': '不适合复杂照护',
  '被照护对象': '正在被照顾',
}

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
            还没写下擅长或需要留意的事
          </span>
        )}
        {traits.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-tiny rounded-full bg-paper-100 border border-paper-200 px-2.5 py-1 text-ink-700"
          >
            {DISPLAY_LABEL[t] ?? t}
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
          className="text-tiny rounded-full text-ink-500 hover:text-rouge-600 border border-dashed border-rouge-200 px-2.5 py-1 hover:border-rouge-400"
        >
          <Plus size={9} className="inline-block -mt-px" /> 添一条
        </button>
      </div>

      {open && (
        <div className="rounded-2xl border border-paper-200 bg-paper p-3 space-y-2">
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
              className="flex-1 bg-paper border border-paper-200 px-3 py-2 text-tiny focus:border-rouge-300 outline-none"
              placeholder="例如：愿意陪诊 / 喜欢周末电话"
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
                  className="text-tiny rounded-full px-2.5 py-1 border border-paper-200 text-ink-600 hover:border-rouge-200"
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
