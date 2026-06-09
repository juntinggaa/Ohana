import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { useAppStore } from '@/lib/store'
import { canViewHouseholdMemory } from '@/lib/agents/familyConversationAgent'
import {
  getLLMModelLabel,
  getLLMProvider,
  getLLMProviderLabel,
  hasDeepSeekKey,
} from '@/lib/llm/llmClient'
import { hasMistralKey } from '@/lib/ocr/mistralOcr'
import { Sparkles, RotateCcw, Trash2, ExternalLink, Shield, CloudOff } from 'lucide-react'

export function SettingsPage() {
  const tasks = useAppStore((s) => s.tasks)
  const accepted = useAppStore((s) => s.accepted)
  const messages = useAppStore((s) => s.familyChatMessages)
  const memories = useAppStore((s) => s.householdMemories)
  const currentUserId = useAppStore((s) => s.currentUserId)
  const resetToSampleData = useAppStore((s) => s.resetToSampleData)
  const clearAll = useAppStore((s) => s.clearAll)
  const pushToast = useAppStore((s) => s.pushToast)
  const visibleMemories = memories.filter((memory) => canViewHouseholdMemory(memory, currentUserId))
  const llmProvider = getLLMProvider()
  const llmProviderLabel = getLLMProviderLabel() ?? 'AI'
  const llmModel = getLLMModelLabel()
  const llmConsole = llmProvider === 'deepseek'
    ? { href: 'https://platform.deepseek.com/', label: 'DeepSeek 控制台' }
    : { href: 'https://openrouter.ai/keys', label: 'OpenRouter 控制台' }

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
        <section className="petal-card p-6 md:p-8">
          <h2 className="font-serif text-h3 text-ink-900 mb-4 inline-flex items-center gap-2">
            <Shield size={18} className="text-rouge-500" />
            隐私与共享
          </h2>
          <div className="space-y-2 text-small">
            <Row
              label="家庭同步"
              value={
                <span className="text-honey-700 inline-flex items-center gap-1.5">
                  <CloudOff size={13} />
                  尚未开启 · 目前仅在这台设备预览
                </span>
              }
            />
            <Row label="家庭聊天" value="发给家人的留言，会显示在全家聊天里" />
            <Row label="问欧哈娜" value="个人提问与回答，只显示给正在提问的身份；发送即使用已配置的 AI" />
            <Row
              label="记忆本权限"
              value={`全家 ${visibleMemories.filter((m) => !m.visibility || m.visibility === 'family').length} 条 · 指定家人 ${visibleMemories.filter((m) => m.visibility === 'selected').length} 条 · 仅自己 ${visibleMemories.filter((m) => m.visibility === 'private').length} 条`}
            />
          </div>
          <p className="mt-4 text-tiny text-ink-500 leading-relaxed rounded-2xl bg-honey-50 border border-honey-100 px-4 py-3">
            跨手机实时聊天与邀请家人，需要接入带登录和访问权限的家庭同步服务。在接入之前，这里不会假装已经把内容分享给其他设备。
            当前设备上的身份切换只用于体验界面，不能替代真正的账号隐私保护。
          </p>
        </section>

        {/* AI 连接 */}
        <section className="petal-card p-6 md:p-8">
          <h2 className="font-serif text-h3 text-ink-900 mb-4">智能辅助</h2>
          <div className="space-y-2 text-small">
            <Row
              label={`${llmProviderLabel} · 对话助手`}
              value={
                hasDeepSeekKey() ? (
                  <span className="text-moss-500">已配置 · {llmModel}</span>
                ) : (
                  <span className="text-ink-400">
                    未配置（.env 缺 VITE_DEEPSEEK_API_KEY / VITE_OPENROUTER_API_KEY）
                  </span>
                )
              }
            />
            <Row
              label="OCR.space · 图片识别"
              value={
                hasMistralKey() ? (
                  <span className="text-moss-500">已配置 · OCR Engine 2 · 简体中文</span>
                ) : (
                  <span className="text-ink-400">未配置（.env 缺 VITE_OCR_SPACE_API_KEY）</span>
                )
              }
            />
            <Row
              label="图片整理方式"
              value={
                hasMistralKey() && hasDeepSeekKey()
                  ? `图片 → OCR.space → ${llmProviderLabel} (${llmModel}) 整理关键信息`
                  : '回退到本地确定性逻辑'
              }
            />
          </div>
          <div className="mt-4 text-tiny text-ink-500 leading-relaxed">
            选择「问欧哈娜」发送问题时，AI 可以回答一般生活与健康常识，也会用与你问题相关的家庭记忆回答家中事实。
            最近 4 轮私聊前文、当前问题与匹配记忆会发送到 {llmProviderLabel}。
            <br />
            生产部署时务必把 Key 放到后端代理，不要打包到前端 JS。
            <br />
            黑客松结束后请到{' '}
            <a
              href={llmConsole.href}
              target="_blank"
              rel="noreferrer"
              className="text-rouge-500 underline underline-offset-4 inline-flex items-center gap-1"
            >
              {llmConsole.label}
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
            <Row label="家庭留言" value={messages.filter((message) => message.audience === 'family').length} />
            <Row label="你能查看的记忆" value={visibleMemories.length} />
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
            本项目仅用于黑客松演示。家庭聊天与记忆默认只保存在当前浏览器；选择「问欧哈娜」
            发送问题时，最近 4 轮私聊前文、当前问题与匹配记忆会发送给所选模型处理。
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
