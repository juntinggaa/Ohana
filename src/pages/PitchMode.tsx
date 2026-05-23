import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn, formatPercent } from '@/lib/utils'
import {
  FAMILY_MEMBERS,
  MENTAL_LOAD_AFTER,
  MENTAL_LOAD_BEFORE,
  SAMPLE_TASKS,
} from '@/lib/mockData'
import { Avatar } from '@/components/Avatar'
import type { WeeklyMentalLoadSnapshot } from '@/lib/types'

interface Slide {
  eyebrow: string
  /** 大字 · 衬线 */
  title: React.ReactNode
  /** 副歌 · 选填 */
  body?: React.ReactNode
  footnote?: string
}

const tangningBefore = MENTAL_LOAD_BEFORE.entries.find((e) => e.memberId === 'tangning')!
const tangningAfter = MENTAL_LOAD_AFTER.entries.find((e) => e.memberId === 'tangning')!

const SLIDES: Slide[] = [
  {
    eyebrow: '第五夜 · 待办家事',
    title: (
      <>
        凌晨 1:37，
        <br />
        唐宁突然坐起来。
      </>
    ),
    body: (
      <p className="font-serif italic text-h3 text-paper/70 leading-relaxed max-w-2xl">
        她没有做噩梦。
        <br />
        只是突然想起 —— 爸爸的降压药，可能只剩两片了。
      </p>
    ),
    footnote: '这一刻，全家在睡。后台只有她一个人在运转。',
  },
  {
    eyebrow: '我们想说的事',
    title: (
      <>
        每一个家庭，
        <br />
        都有一个一直在记的人。
      </>
    ),
    body: (
      <div className="space-y-3 text-h3 font-serif text-paper/70 max-w-2xl leading-relaxed">
        <p>家庭群看到的是「她下单了」。</p>
        <p>没人看到她想到了、追问了、核对了、兜底了。</p>
        <p className="text-rouge-200 not-italic font-sans text-body uppercase tracking-widest pt-4">
          —— 这部分一直没有被命名为劳动
        </p>
      </div>
    ),
  },
  {
    eyebrow: '原料 · 七条消息',
    title: <>她家上周的家庭群，长这样。</>,
    body: (
      <div className="font-mono text-small text-paper/80 leading-loose space-y-1 max-w-3xl">
        <div>[家庭群] 妈妈：你爸药快没了。</div>
        <div>[家庭群] 弟弟：收到。</div>
        <div className="text-paper/40">… 深夜 22:46 …</div>
        <div>[家庭群] 唐宁：我先下单了。</div>
        <div>[家庭群] 妈妈：你怎么还没睡？别管了。</div>
        <div>[医院] 周一 9:20 高血压复诊…</div>
        <div>[幼儿园] 明天请带亲子手工作品。</div>
        <div>[物业] 燃气年检请于本周内预约。</div>
      </div>
    ),
  },
  {
    eyebrow: 'AI 工作 · 三个 Agent',
    title: <>识别 · 展开 · 审计。</>,
    body: (
      <div className="grid grid-cols-2 gap-4 max-w-4xl">
        {SAMPLE_TASKS.slice(0, 4).map((t) => (
          <div key={t.id} className="border-l-2 border-rouge-200 pl-5 py-2">
            <div className="text-eyebrow text-rouge-200 uppercase tracking-widest">
              {t.dueDateText ?? '本周内'}
            </div>
            <div className="font-serif text-h3 text-paper mt-2 leading-tight">{t.title}</div>
            <div className="mt-3 text-tiny text-paper/60 leading-relaxed">
              推荐 · {FAMILY_MEMBERS.find((m) => m.id === t.suggestedOwnerId)?.name ?? '—'} ·{' '}
              {t.suggestionReason}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: '核心创新',
    title: (
      <>
        「收到」
        <br />
        不等于责任。
      </>
    ),
    body: (
      <div className="grid grid-cols-2 gap-8 max-w-4xl pt-4">
        <div className="border-t border-rouge-300/50 pt-6">
          <div className="text-eyebrow text-rouge-200">之前</div>
          <div className="font-mono text-paper/80 mt-4 space-y-2">
            <div>妈妈：你爸药快没了</div>
            <div>弟弟：收到</div>
            <div className="text-rouge-200 italic">（任务在掉回唐宁）</div>
          </div>
        </div>
        <div className="border-t border-moss-400/50 pt-6">
          <div className="text-eyebrow text-moss-400">之后</div>
          <div className="text-paper/85 mt-4 space-y-2 text-body">
            <div>执行人：弟弟</div>
            <div>截止：明天中午前</div>
            <div>证明：药品照片 + 订单截图</div>
            <div className="text-moss-300 italic">状态：已承接</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: '心智负担可视化',
    title: (
      <>
        <span className="num text-display text-rouge-200">
          {Math.round(tangningBefore.percentage * 100)}%
        </span>
        <span className="font-serif text-h2 text-paper/50 mx-3">→</span>
        <span className="num text-display text-moss-400">
          {Math.round(tangningAfter.percentage * 100)}%
        </span>
      </>
    ),
    body: (
      <div className="grid grid-cols-2 gap-8 max-w-4xl pt-2">
        <BarsSlide snapshot={MENTAL_LOAD_BEFORE} accent="rouge" />
        <BarsSlide snapshot={MENTAL_LOAD_AFTER} accent="moss" />
      </div>
    ),
    footnote: '我们没有让她更高效。我们让她可以不在场。',
  },
  {
    eyebrow: '产品定位',
    title: (
      <>
        后台审计
        <br />
        不是一个待办清单。
      </>
    ),
    body: (
      <p className="font-serif italic text-h3 text-paper/80 leading-relaxed max-w-2xl">
        它是一个
        <span className="text-rouge-200 not-italic font-sans"> 家庭责任交接系统</span>。
        <br />
        把混乱消息变成可执行、可追踪、可审计的责任流程，
        <br />
        让一直在记的那个人，被看见。
      </p>
    ),
  },
  {
    eyebrow: '收尾',
    title: (
      <span className="font-serif italic">
        我们不是要让她更高效。
        <br />
        我们是要让家庭，
        <br />
        更有责任感。
      </span>
    ),
  },
]

function BarsSlide({
  snapshot,
  accent,
}: {
  snapshot: WeeklyMentalLoadSnapshot
  accent: 'rouge' | 'moss'
}) {
  const max = Math.max(...snapshot.entries.map((e) => e.score), 1)
  return (
    <div>
      <div
        className={
          'text-eyebrow uppercase tracking-widest mb-4 ' +
          (accent === 'rouge' ? 'text-rouge-200' : 'text-moss-400')
        }
      >
        {snapshot.label}
      </div>
      {snapshot.entries
        .filter((e) => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((e) => {
          const m = FAMILY_MEMBERS.find((mm) => mm.id === e.memberId)!
          const width = (e.score / max) * 100
          return (
            <div key={e.memberId} className="grid grid-cols-[100px_1fr_44px] items-center gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar member={m} size={18} />
                <span className="text-tiny text-paper truncate">{m.name}</span>
              </div>
              <div className="h-[2px] bg-paper/15 overflow-hidden">
                <div
                  className={
                    'h-full ' + (accent === 'rouge' ? 'bg-rouge-200' : 'bg-moss-400')
                  }
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="num text-tiny text-paper/80 text-right">
                {formatPercent(e.percentage)}
              </div>
            </div>
          )
        })}
    </div>
  )
}

export function PitchModePage() {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const total = SLIDES.length
  const slide = SLIDES[idx]

  // 键盘导航
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') setIdx((i) => Math.min(i + 1, total - 1))
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0))
      if (e.key === 'Escape') navigate('/dashboard')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, navigate])

  return (
    <div className="min-h-screen flex flex-col bg-ink-900 text-paper">
      <div className="flex items-center justify-between px-10 py-6">
        <button
          className="text-tiny text-paper/60 hover:text-paper flex items-center gap-2"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={12} />
          回到产品
        </button>
        <div className="text-tiny text-paper/40 num">
          {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
      </div>

      <div className="flex-1 grid place-items-center px-10 lg:px-20 pb-10">
        <div className="max-w-5xl w-full animate-fade-up" key={idx}>
          <div className="eyebrow text-rouge-200 mb-8">{slide.eyebrow}</div>
          <h1 className="font-serif text-paper leading-[1.05] text-[56px] md:text-[72px] tracking-tight mb-12">
            {slide.title}
          </h1>
          {slide.body}
          {slide.footnote && (
            <div className="mt-12 font-serif italic text-lead text-paper/60 max-w-xl">
              {slide.footnote}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-10 py-6 border-t border-paper/10">
        <button
          className="text-tiny text-paper/60 hover:text-paper flex items-center gap-2 disabled:opacity-20"
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          disabled={idx === 0}
        >
          <ArrowLeft size={12} />
          上一张
        </button>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={cn(
                'h-px transition-all',
                i === idx ? 'w-12 bg-rouge-200' : 'w-3 bg-paper/20',
              )}
              onClick={() => setIdx(i)}
              aria-label={`跳到第 ${i + 1} 张`}
            />
          ))}
        </div>
        <button
          className="text-tiny text-paper flex items-center gap-2 disabled:opacity-20"
          onClick={() => setIdx((i) => Math.min(i + 1, total - 1))}
          disabled={idx === total - 1}
        >
          下一张
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  )
}
