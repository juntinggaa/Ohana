/**
 * Agent 1 · Task Capture Agent
 *
 * 把混乱的家庭消息、医院提醒、学校通知、物业通知，
 * 转成结构化任务。
 *
 * MVP 阶段：基于关键词 + 上下文窗口的确定性逻辑。
 * 明天替换为真实 LLM 调用后，输出类型保持一致。
 */

import { getMember } from '../mockData'
import type { CareTask, TaskCategory, Urgency } from '../types'
import { callRemote, type LLMResponse } from '../llm/llmClient'

interface Pattern {
  match: RegExp[]
  category: TaskCategory
  urgency: Urgency
  buildTitle: (text: string) => string
  suggestedOwnerId: (context: { hasMomNearby?: boolean }) => string
  suggestionReason: string
  requiredProof?: string[]
}

const PATTERNS: Pattern[] = [
  {
    match: [/药.*没/, /药.*快/, /处方/, /开药/, /配药/],
    category: 'elderly_care',
    urgency: 'high',
    buildTitle: () => '老人药品补货',
    suggestedOwnerId: () => 'bro',
    suggestionReason: '弟弟与父母同城，到药店或代取处方成本最低。',
    requiredProof: ['药品照片', '小票或订单截图'],
  },
  {
    match: [/复诊/, /门诊/, /挂号/, /高血压/, /心电/, /检查/],
    category: 'medical',
    urgency: 'high',
    buildTitle: () => '医院复诊安排',
    suggestedOwnerId: () => 'bro',
    suggestionReason: '需要现场陪诊和拍处方，弟弟同城最合适。',
    requiredProof: ['处方照片', '缴费单照片'],
  },
  {
    match: [/燃气/, /物业/, /年检/, /电表/, /水表/],
    category: 'household_admin',
    urgency: 'medium',
    buildTitle: () => '物业 / 家务行政',
    suggestedOwnerId: () => 'zhou',
    suggestionReason: '居家事务，丈夫在家可对接师傅。',
    requiredProof: ['合格证或完成单据照片'],
  },
  {
    match: [/幼儿园/, /学校/, /家长/, /手工/, /作品/, /家委/, /班级/],
    category: 'child_school',
    urgency: 'medium',
    buildTitle: () => '孩子学校任务',
    suggestedOwnerId: () => 'zhou',
    suggestionReason: '伴侣可承接学校任务，减少唐宁连续两段独自承担。',
    requiredProof: ['完成现场照片'],
  },
  {
    match: [/报销/, /发票/, /缴费/, /票据/],
    category: 'reimbursement',
    urgency: 'low',
    buildTitle: () => '票据 / 报销整理',
    suggestedOwnerId: () => 'tangning',
    suggestionReason: '集中在周三晚处理，避免散落到日常。',
  },
]

/** 从一句话中识别紧迫程度的兜底关键词 */
function detectUrgency(text: string, base: Urgency): Urgency {
  if (/今天|马上|快|紧急|立刻/.test(text)) return 'high'
  if (/本周|明天|后天/.test(text)) {
    return base === 'low' ? 'medium' : base
  }
  return base
}

/** 把"医院 / 老师 / 物业"这类系统消息识别为"非家庭成员发起" */
function detectOriginatorId(speakerId?: string): string {
  if (!speakerId || speakerId === 'system') return 'system'
  if (getMember(speakerId)) return speakerId
  return 'system'
}

export interface CapturedTask
  extends Omit<CareTask, 'subtasks' | 'sourceMessageIds' | 'sourceSummary'> {
  matchedLine: string
  /** 表示"AI 是基于哪几个关键词触发的" —— 用于 UI 解释性展示 */
  matchedKeywords: string[]
  confidence: number
}

/**
 * 从一段任意文本（可包含多条消息，按行）识别任务。
 *
 * 现实里我们会传入结构化 RawMessage[]，但为了支持用户在 UI 里粘贴杂乱聊天，
 * 这里同时接受纯文本。
 */
export function captureTasksFromMessages(input: string): CapturedTask[] {
  const lines = input
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const results: CapturedTask[] = []

  lines.forEach((line, idx) => {
    const speakerMatch = line.match(/([^[\]:：]+)[：:]\s*(.*)$/)
    const speakerLabel = speakerMatch?.[1]?.trim() ?? ''
    const body = (speakerMatch?.[2] ?? line).trim()

    PATTERNS.forEach((p) => {
      const matched = p.match.filter((re) => re.test(body))
      if (matched.length === 0) return

      const urgency = detectUrgency(body, p.urgency)
      const originatorId = detectOriginatorId(
        speakerLabel === '妈妈'
          ? 'mom'
          : speakerLabel === '弟弟'
            ? 'bro'
            : speakerLabel === '唐宁'
              ? 'tangning'
              : speakerLabel === '周勉'
                ? 'zhou'
                : 'system',
      )

      results.push({
        id: `cap-${idx}-${p.category}`,
        title: p.buildTitle(body),
        category: p.category,
        originatorId,
        status: 'detected',
        urgency,
        suggestedOwnerId: p.suggestedOwnerId({}),
        suggestionReason: p.suggestionReason,
        requiredProof: p.requiredProof,
        aiExplanation: `检测到关键词：${matched.map((re) => re.source).join('、')}。归类为「${p.category}」，建议负责人：${p.suggestedOwnerId({})}。`,
        matchedLine: line,
        matchedKeywords: matched.map((re) => re.source),
        confidence: Math.min(0.55 + matched.length * 0.15, 0.95),
      })
    })
  })

  // 去重：同类目下保留 confidence 最高的一条
  const deduped = new Map<string, CapturedTask>()
  results.forEach((r) => {
    const key = r.category + r.title
    const prev = deduped.get(key)
    if (!prev || prev.confidence < r.confidence) deduped.set(key, r)
  })
  return Array.from(deduped.values())
}

/**
 * Wrapper 以便明天替换为 LLM 调用 —— 接口签名保持一致。
 */
export async function analyzeFamilyMessages(
  input: string,
): Promise<LLMResponse<CapturedTask[]>> {
  const fallback = captureTasksFromMessages(input)
  return callRemote(
    `请识别下列家庭消息中的待办任务：\n${input}`,
    fallback,
    '本地确定性关键词识别 · 明天可替换为 DeepSeek / Claude',
  )
}
