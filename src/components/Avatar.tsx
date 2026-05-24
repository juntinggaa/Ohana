import { cn } from '@/lib/utils'
import type { FamilyMember } from '@/lib/types'

// Map older sample colors into the soft household palette.
const COLOR_MAP: Record<string, string> = {
  'bg-ember-600 text-white':  'bg-rouge-500 text-paper',
  'bg-ink-700 text-white':    'bg-ink-800 text-paper',
  'bg-ink-400 text-white':    'bg-ink-500 text-paper',
  'bg-moss-600 text-white':   'bg-moss-500 text-paper',
  'bg-moss-400 text-white':   'bg-moss-400 text-paper',
  'bg-ember-300 text-ink-900': 'bg-rouge-200 text-ink-900',
}

export function Avatar({
  member,
  size = 32,
  className,
}: {
  member: FamilyMember
  size?: number
  className?: string
}) {
  const px = `${size}px`
  const color = COLOR_MAP[member.avatarColor] ?? member.avatarColor
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center font-medium shrink-0 font-serif shadow-soft',
        color,
        className,
      )}
      style={{ width: px, height: px, fontSize: size * 0.45, borderRadius: '9999px' }}
      title={`${member.name} · ${member.relation}`}
    >
      {member.name.slice(-1)}
    </div>
  )
}
