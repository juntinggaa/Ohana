import { PageHeader } from '@/components/PageHeader'
import { MentalLoadDashboard } from '@/components/MentalLoadDashboard'
import { ResponsibilityTransferPanel } from '@/components/ResponsibilityTransferPanel'
import { useAppStore } from '@/lib/store'

export function MentalLoadPage() {
  const tasks = useAppStore((s) => s.tasks)
  const risks = useAppStore((s) => s.risks)
  const mentalLoadBefore = useAppStore((s) => s.mentalLoadBefore)
  const mentalLoadAfter = useAppStore((s) => s.mentalLoadAfter)
  const acceptedCount = useAppStore((s) => Object.keys(s.accepted).length)

  return (
    <>
      <PageHeader
        title="彼此的心事"
        description="看见谁最近惦记得多一些，才知道可以先抱抱谁、帮帮谁。"
      />

      <section className="max-w-6xl mx-auto px-8 lg:px-12 pb-12">
        <div className="petal-card p-6 md:p-8">
          <MentalLoadDashboard
            before={{ label: '本周', entries: mentalLoadBefore }}
            after={{
              label: acceptedCount > 0 ? `已分担 ${acceptedCount} 条后` : '若按建议分担',
              entries: mentalLoadAfter,
            }}
            initialView={acceptedCount > 0 ? 'after' : 'before'}
          />
        </div>
      </section>

      <section className="border-t border-paper-200 bg-paper-100/60">
        <div className="max-w-6xl mx-auto px-8 lg:px-12 py-12">
          <ResponsibilityTransferPanel risks={risks} tasks={tasks} initialVisible={3} />
        </div>
      </section>
    </>
  )
}
