import type { FamilyMember } from '@/lib/types'
import { getMember } from '@/lib/mockData'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'

export function MemberPill({
  id,
  size = 'sm',
  className,
}: {
  id?: string
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  if (!id) return null
  const member: FamilyMember | undefined = getMember(id)
  if (!member) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-tiny text-ink-500', className)}>
        {id === 'system' ? '系统' : id}
      </span>
    )
  }

  const px = size === 'xs' ? 16 : size === 'md' ? 22 : 18
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        className,
      )}
    >
      <Avatar member={member} size={px} />
      <span className="text-tiny text-ink-700">{member.name}</span>
    </span>
  )
}
