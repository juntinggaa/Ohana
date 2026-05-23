import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { MentalLoadDashboard } from '@/components/MentalLoadDashboard'
import { ResponsibilityTransferPanel } from '@/components/ResponsibilityTransferPanel'
import {
  MENTAL_LOAD_AFTER,
  MENTAL_LOAD_BEFORE,
  SAMPLE_RISKS,
  SAMPLE_TASKS,
} from '@/lib/mockData'

export function DashboardPage() {
  const fallbackCount = SAMPLE_TASKS.filter((t) => t.status === 'fallback_risk').length
  const vagueCount = SAMPLE_RISKS.filter((r) => r.type === 'vague_acknowledgement').length
  const before = MENTAL_LOAD_BEFORE.entries.find((e) => e.memberId === 'tangning')!.percentage
  const after = MENTAL_LOAD_AFTER.entries.find((e) => e.memberId === 'tangning')!.percentage
  const drop = Math.round((before - after) * 100)

  return (
    <>
      <PageHeader
        eyebrow="第五夜 · 待办家事"
        title="家里一直有人在记住，只是没人喊出名字。"
        kicker="后台审计把「想到并安排」这件事，从一个人脑子里搬出来。"
        actions={
          <Link to="/pitch" className="btn-outline">
            进入 Pitch
          </Link>
        }
      />

      {/* Hero · 一个大数字 + 三个小数据 */}
      <section className="max-w-6xl mx-auto px-8 lg:px-12 pb-16">
        <div className="border-t border-ink-200 pt-12 grid lg:grid-cols-[1fr_auto] gap-12 items-end">
          <div>
            <div className="eyebrow mb-4">凌晨 1:37 · 唐宁突然坐起来</div>
            <div className="flex items-baseline gap-4">
              <span className="num text-display text-rouge-500 leading-none">
                {Math.round(before * 100)}
              </span>
              <span className="font-serif text-h2 text-ink-500">%</span>
              <span className="font-serif text-h3 text-ink-700 italic ml-2">
                的家庭后台
              </span>
            </div>
            <p className="mt-5 font-serif text-lead text-ink-700 italic max-w-xl">
              这是她一个人脑子里在跑的份额。
              其他人各做各的事，但"谁该想到"一直没人接。
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-x-10 gap-y-2 text-right md:text-left lg:border-l lg:border-ink-200 lg:pl-12">
            <Stat label="掉回唐宁" value={fallbackCount} />
            <Stat label="模糊承接" value={vagueCount} />
            <Stat label="可下降" value={`${drop}%`} tone="moss" />
          </dl>
        </div>
      </section>

      {/* Mental Load story */}
      <section className="border-t border-ink-200 bg-paper-100">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 py-16">
          <MentalLoadDashboard before={MENTAL_LOAD_BEFORE} after={MENTAL_LOAD_AFTER} />
        </div>
      </section>

      {/* Responsibility risks */}
      <section className="max-w-6xl mx-auto px-8 lg:px-12 py-16">
        <ResponsibilityTransferPanel
          risks={SAMPLE_RISKS}
          tasks={SAMPLE_TASKS}
          initialVisible={2}
        />
      </section>
    </>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string | number
  tone?: 'default' | 'moss'
}) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div
        className={
          'num text-h2 leading-none ' +
          (tone === 'moss' ? 'text-moss-500' : 'text-ink-900')
        }
      >
        {value}
      </div>
    </div>
  )
}
