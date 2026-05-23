import { cn } from '@/lib/utils'

/**
 * Ohana · 欧哈娜
 *
 * Logo · 两只手环抱一个家
 *   - 深色双弧 = 围拢的两只手（一上一下 · 互锁）
 *   - 中央赭红小房子 = 家
 *
 * 用 CSS 变量保持跟随父级颜色 · 但内部红色 House 强制 rouge-500 · 不变
 *
 * 若想用像素图，把同名 PNG 放到 public/logo.png，然后改 <img src="/logo.png" />
 */
export function Logo({
  size = 24,
  className,
  withWordmark = false,
}: {
  size?: number
  className?: string
  withWordmark?: boolean
}) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={!withWordmark || undefined}
      role={withWordmark ? undefined : 'img'}
      aria-label={withWordmark ? undefined : 'Ohana 欧哈娜'}
    >
      {/* 上方手臂 · 从左下绕到右上 */}
      <path
        d="M 8 36 A 24 24 0 0 1 50 17"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* 上方"手指"小细线 · 暗示是手 */}
      <line x1="48" y1="22" x2="51" y2="29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="53" y1="20" x2="56" y2="27" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />

      {/* 下方手臂 · 从右上绕到左下 */}
      <path
        d="M 56 28 A 24 24 0 0 1 14 47"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* 下方"手指" */}
      <line x1="16" y1="42" x2="13" y2="35" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="11" y1="44" x2="8" y2="37" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />

      {/* 中央 · 赭红小房子 */}
      {/* 屋顶 */}
      <path d="M 32 21 L 21 34 L 43 34 Z" fill="#B5462D" />
      {/* 房身 */}
      <rect x="23" y="33" width="18" height="14" fill="#B5462D" />
      {/* 门洞 · 用底色 paper 露出 */}
      <path d="M 29 47 L 29 41 A 3 3 0 0 1 35 41 L 35 47 Z" fill="#F7F3EB" />
    </svg>
  )

  if (!withWordmark) {
    return <span className={cn('inline-flex text-ink-900', className)}>{svg}</span>
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5 text-ink-900', className)}>
      <span className="inline-flex">{svg}</span>
      <span className="inline-flex items-baseline gap-2">
        <span className="font-serif text-h3 leading-none">欧哈娜</span>
        <span className="text-eyebrow uppercase tracking-widest text-ink-400 hidden lg:inline">
          Ohana
        </span>
      </span>
    </span>
  )
}
