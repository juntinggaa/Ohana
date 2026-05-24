import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { useAppStore } from '@/lib/store'
import { hasDeepSeekKey } from '@/lib/llm/llmClient'
import { hasMistralKey } from '@/lib/ocr/mistralOcr'
import { Sparkles, RotateCcw, Trash2, ExternalLink } from 'lucide-react'

export function SettingsPage() {
  const tasks = useAppStore((s) => s.tasks)
  const accepted = useAppStore((s) => s.accepted)
  const resetToSampleData = useAppStore((s) => s.resetToSampleData)
  const clearAll = useAppStore((s) => s.clearAll)
  const pushToast = useAppStore((s) => s.pushToast)

  function handleReset() {
    if (confirm('确定回到唐宁家示例吗？当前留下的近况和回应会清空。')) {
      resetToSampleData()
      pushToast('已重置为示例家庭', 'info')
    }
  }

  function handleClear() {
    if (confirm('确定清空所有家庭记忆和照应记录吗？')) {
      clearAll()
      pushToast('数据已清空', 'info')
    }
  }

  return (
    <>
      <PageHeader title="设置" description="管理家庭资料、辅助功能与演示入口。" />

      <div className="max-w-3xl mx-auto px-6 lg:px-12 pb-20 space-y-5">
        {/* AI 连接 */}
        <section className="petal-card p-6 md:p-8">
          <h2 className="font-serif text-h3 text-ink-900 mb-4">智能辅助</h2>
          <div className="space-y-2 text-small">
            <Row
              label="OpenRouter · 消息整理"
              value={
                hasDeepSeekKey() ? (
                  <span className="text-moss-500">已连接 · deepseek/deepseek-chat (v3)</span>
                ) : (
                  <span className="text-ink-400">未配置（.env 缺 VITE_OPENROUTER_API_KEY）</span>
                )
              }
            />
            <Row
              label="OCR.space · 图片识别"
              value={
                hasMistralKey() ? (
                  <span className="text-moss-500">已连接 · OCR Engine 2 · 简体中文</span>
                ) : (
                  <span className="text-ink-400">未配置（.env 缺 VITE_OCR_SPACE_API_KEY）</span>
                )
              }
            />
            <Row
              label="图片整理方式"
              value={
                hasMistralKey() && hasDeepSeekKey()
                  ? '图片 → OCR.space → OpenRouter (DeepSeek-V3) 整理关键信息'
                  : '回退到本地确定性逻辑'
              }
            />
          </div>
          <div className="mt-4 text-tiny text-ink-500 leading-relaxed">
            生产部署时务必把 Key 放到后端代理，不要打包到前端 JS。
            <br />
            黑客松结束后请到{' '}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="text-rouge-500 underline underline-offset-4 inline-flex items-center gap-1"
            >
              OpenRouter 控制台
              <ExternalLink size={10} />
            </a>
            和{' '}
            <a
              href="https://ocr.space/ocrapi"
              target="_blank"
              rel="noreferrer"
              className="text-rouge-500 underline underline-offset-4 inline-flex items-center gap-1"
            >
              OCR.space 控制台
              <ExternalLink size={10} />
            </a>{' '}
            轮换密钥。
          </div>
        </section>

        {/* 数据 */}
        <section className="petal-card p-6 md:p-8">
          <h2 className="font-serif text-h3 text-ink-900 mb-4">你的家庭资料</h2>
          <div className="space-y-2 text-small mb-6">
            <Row label="正在留意的事" value={tasks.length} />
            <Row label="家人的回应" value={Object.keys(accepted).length} />
            <Row label="存储位置" value="浏览器 localStorage · 键 ohana:v1" />
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn-outline" onClick={handleReset}>
              <RotateCcw size={12} />
              重置为唐宁家示例
            </button>
            <button className="btn-ghost" onClick={handleClear}>
              <Trash2 size={12} />
              全部清空
            </button>
          </div>
        </section>

        {/* 演示 */}
        <section className="petal-card p-6 md:p-8">
          <h2 className="font-serif text-h3 text-ink-900 mb-4">演示与文档</h2>
          <div className="space-y-3">
            <Link
              to="/pitch"
              className="inline-flex items-center gap-2 text-small text-ink-700 hover:text-rouge-500"
            >
              <Sparkles size={12} />
              打开演讲模式（黑客松路演用）
            </Link>
            <p className="text-tiny text-ink-500">
              演讲模式是一组 9 张全屏幻灯，用 ←/→/Space/Esc 键控制。它读静态数据，不会影响当前家庭内容。
            </p>
          </div>
        </section>

        {/* 关于 */}
        <section className="petal-card p-6 md:p-8">
          <h2 className="font-serif text-h3 text-ink-900 mb-4">关于</h2>
          <p className="text-small text-ink-600 leading-relaxed">
            欧哈娜 · Ohana · v0.3.0
            <br />
            Ohana 在夏威夷语里是"家人"的意思 —— 不让任何人独自扛着。
            <br />
            本项目仅用于黑客松演示，不存储用户家庭聊天数据到任何服务器。所有数据只保存在你当前的浏览器里。
          </p>
        </section>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 py-2 border-b border-paper-200">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900">{value}</span>
    </div>
  )
}
