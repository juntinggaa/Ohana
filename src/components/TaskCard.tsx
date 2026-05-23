import type { CareTask } from '@/lib/types'
import { MemberPill } from './MemberPill'
import { OriginatorLabel } from './OriginatorLabel'
import { statusVisualForTask } from '@/lib/status'
import { useAppStore } from '@/lib/store'
import { cn, formatDueDate } from '@/lib/utils'

const CATEGORY_LABEL: Record<CareTask['category'], string> = {
  elderly_care: '老人照护',
  medical: '医疗复诊',
  child_school: '孩子学校',
  household_admin: '家务行政',
  reimbursement: '票据报销',
  general_family: '家事',
}

export function TaskCard({
  task,
  onClick,
  active,
  simpleMode = false,
}: {
  task: CareTask
  onClick?: () => void
  active?: boolean
  simpleMode?: boolean
}) {
  const currentUserId = useAppStore((s) => s.currentUserId)
  const v = statusVisualForTask(task, currentUserId)
  const label = simpleMode ? v.simpleLabel : v.proLabel

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-paper-50 border-l-2 transition group',
        'px-6 py-5',
        // 三色：红 / 黄 / 绿 / neutral
        v.tone === 'red'
          ? 'border-rouge-500'
          : v.tone === 'yellow'
            ? 'border-rouge-200'
            : v.tone === 'green'
              ? 'border-moss-500'
              : active
                ? 'border-ink-900'
                : 'border-ink-200 hover:border-ink-500',
      )}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="eyebrow">{CATEGORY_LABEL[task.category]}</span>
        <span className={cn('text-tiny font-medium', v.textCls)}>{label}</span>
      </div>

      <h3 className="font-serif text-h3 text-ink-900 leading-tight">{task.title}</h3>

      {(task.dueDate || task.dueDateText) && (
        <div className="text-tiny text-ink-500 mt-1.5">
          {formatDueDate(task.dueDate) ?? task.dueDateText}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-tiny">
        <span className="flex items-center gap-1.5 text-ink-500">
          <span className="text-ink-400">{simpleMode ? '谁先提到' : '发起'}</span>
          <OriginatorLabel
            id={task.originatorId}
            label={task.originatorLabel}
            size="xs"
          />
        </span>
        {task.suggestedOwnerId && (
          <span className="flex items-center gap-1.5 text-ink-500">
            <span className="text-ink-400">{simpleMode ? '谁来做' : '建议'}</span>
            <MemberPill id={task.suggestedOwnerId} size="xs" />
          </span>
        )}
      </div>
    </button>
  )
}
