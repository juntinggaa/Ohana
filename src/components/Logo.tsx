import { cn } from '@/lib/utils'

/**
 * Ohana · 欧哈娜
 *
 * Logo · 一个屋顶
 * Ohana 在夏威夷语里就是"家人"的意思 —— 屋顶代表家。
 *
 * 极简的钢笔线条 · 屋脊 + 一个小烟囱
 * 用 currentColor，跟随父级文字颜色（默认 ink-900，hover/active 时可变 rouge）。
 */
export function Logo({
  size = 22,
  className,
  withWordmark = false,
}: {
  size?: number
  className?: string
  /** 同时显示「欧哈娜 / OHANA」字样 */
  withWordmark?: boolean
}) {
  const svg = (
    <svg
      width={size * 1.55}
      height={size}
      viewBox="0 0 32 20"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={!withWordmark || undefined}
      role={withWordmark ? undefined : 'img'}
      aria-label={withWordmark ? undefined : 'Ohana 欧哈娜'}
    >
      {/* 屋脊 · 两根线 */}
      <path
        d="M2 17 L16 4 L30 17"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 屋檐底 · 一根细横线，表示这是一个家 */}
      <path
        d="M5 17 L27 17"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* 小烟囱 · 一个小红点（用 rouge-500 单独画） */}
      <rect x="21" y="7.2" width="2.2" height="3.4" rx="0.4" fill="#B5462D" />
    </svg>
  )

  if (!withWordmark) {
    return <span className={cn('inline-flex text-ink-900', className)}>{svg}</span>
  }

  return (
    <span className={cn('inline-flex items-baseline gap-2.5 text-ink-900', className)}>
      <span className="inline-flex items-end translate-y-[3px]">{svg}</span>
      <span className="font-serif text-h3 leading-none">欧哈娜</span>
      <span className="text-eyebrow uppercase tracking-widest text-ink-400 hidden lg:inline">
        Ohana
      </span>
    </span>
  )
}
