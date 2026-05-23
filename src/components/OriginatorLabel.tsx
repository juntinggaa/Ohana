import { useAppStore } from '@/lib/store'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'

/**
 * 显示「发起人」—— 永远是一个家庭成员
 * （之前会显示"医院提醒/物业/学校"等外部渠道，已改为统一显示
 *   "把这件事告诉 AI 的那个人"）
 */
export function OriginatorLabel({
  id,
  label,
  size = 'sm',
  className,
}: {
  id?: string
  /** 可选的显示文字覆盖；默认用 member.name */
  label?: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const member = useAppStore((s) =>
    id ? s.familyMembers.find((m) => m.id === id) : undefined,
  )

  const px = size === 'xs' ? 16 : size === 'md' ? 22 : 18

  if (!member) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-tiny text-ink-500', className)}>
        {label ?? '未知'}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Avatar member={member} size={px} />
      <span className="text-tiny text-ink-700">{label ?? member.name}</span>
    </span>
  )
}
