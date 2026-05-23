import { PageHeader } from '@/components/PageHeader'
import { MentalLoadDashboard } from '@/components/MentalLoadDashboard'
import { ResponsibilityTransferPanel } from '@/components/ResponsibilityTransferPanel'
import {
  MENTAL_LOAD_AFTER,
  MENTAL_LOAD_BEFORE,
  SAMPLE_RISKS,
  SAMPLE_TASKS,
} from '@/lib/mockData'

export function MentalLoadPage() {
  return (
    <>
      <PageHeader
        eyebrow="心智负担 · Mental Load Audit"
        title="把「想到并安排」算成一个数。"
        kicker="执行权重最低。兜底权重最高。第一次让隐形劳动有刻度。"
      />

      <section className="max-w-6xl mx-auto px-8 lg:px-12 pb-16">
        <div className="border-t border-ink-200 pt-12">
          <MentalLoadDashboard before={MENTAL_LOAD_BEFORE} after={MENTAL_LOAD_AFTER} />
        </div>
      </section>

      <section className="border-t border-ink-200 bg-paper-100">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 py-16">
          <ResponsibilityTransferPanel
            risks={SAMPLE_RISKS}
            tasks={SAMPLE_TASKS}
            initialVisible={3}
          />
        </div>
      </section>
    </>
  )
}
