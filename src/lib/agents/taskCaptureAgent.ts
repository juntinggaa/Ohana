/**
 * Agent 1 · Task Capture Agent · DeepSeek 主线
 *
 * 输入：一段任意格式的家庭消息文本
 * 输出：结构化的 CapturedTask[]
 *
 * 策略：
 *   1. 优先使用 DeepSeek 远程 JSON 模式
 *   2. 失败 / 没 key 时回退到本地关键词匹配
 */

import { getMember } from '../mockData'
import type { TaskCategory, Urgency } from '../types'
import {
  callDeepSeek,
  callRemoteWithFallback,
  extractJson,
  type LLMResponse,
} from '../llm/llmClient'

export interface CapturedTask {
  id: string
  title: string
  category: TaskCategory
  urgency: Urgency
  originatorId: string
  suggestedOwnerId?: string
  suggestionReason?: string
  requiredProof?: string[]
  aiExplanation?: string
  dueDateText?: string
  matchedLine: string
  matchedKeywords: string[]
  confidence: number
}

interface Pattern {
  match: RegExp[]
  category: TaskCategory
  urgency: Urgency
  buildTitle: (text: string) => string
  suggestedOwnerId: string
  suggestionReason: string
  requiredProof?: string[]
}

const PATTERNS: Pattern[] = [
  {
    match: [/药.*没/, /药.*快/, /处方/, /开药/, /配药/],
    category: 'elderly_care',
    urgency: 'high',
    buildTitle: () => '老人药品补货',
    suggestedOwnerId: 'bro',
    suggestionReason: '弟弟与父母同城，到药店或代取处方成本最低。',
    requiredProof: ['药品照片', '小票或订单截图'],
  },
  {
    match: [/复诊/, /门诊/, /挂号/, /高血压/, /心电/, /检查/],
    category: 'medical',
    urgency: 'high',
    buildTitle: () => '医院复诊安排',
    suggestedOwnerId: 'bro',
    suggestionReason: '需要现场陪诊和拍处方，弟弟同城最合适。',
    requiredProof: ['处方照片', '缴费单照片'],
  },
  {
    match: [/燃气/, /物业/, /年检/, /电表/, /水表/],
    category: 'household_admin',
    urgency: 'medium',
    buildTitle: () => '物业 / 家务行政',
    suggestedOwnerId: 'zhou',
    suggestionReason: '居家事务，丈夫在家可对接师傅。',
    requiredProof: ['合格证或完成单据照片'],
  },
  {
    match: [/幼儿园/, /学校/, /家长/, /手工/, /作品/, /家委/, /班级/],
    category: 'child_school',
    urgency: 'medium',
    buildTitle: () => '孩子学校任务',
    suggestedOwnerId: 'zhou',
    suggestionReason: '伴侣可承接学校任务，减少唐宁连续两段独自承担。',
    requiredProof: ['完成现场照片'],
  },
  {
    match: [/报销/, /发票/, /缴费/, /票据/],
    category: 'reimbursement',
    urgency: 'low',
    buildTitle: () => '票据 / 报销整理',
    suggestedOwnerId: 'tangning',
    suggestionReason: '集中在周三晚处理，避免散落到日常。',
  },
]

function detectUrgency(text: string, base: Urgency): Urgency {
  if (/今天|马上|快|紧急|立刻/.test(text)) return 'high'
  if (/本周|明天|后天/.test(text)) return base === 'low' ? 'medium' : base
  return base
}

function detectOriginatorId(speakerId?: string): string {
  if (!speakerId || speakerId === 'system') return 'system'
  if (getMember(speakerId)) return speakerId
  return 'system'
}

/**
 * 本地确定性识别 —— 没 key 或远程挂掉时使用。
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
      const speakerId =
        speakerLabel === '妈妈' ? 'mom'
          : speakerLabel === '弟弟' ? 'bro'
            : speakerLabel === '唐宁' ? 'tangning'
              : speakerLabel === '周勉' ? 'zhou'
                : 'system'

      results.push({
        id: `cap-${idx}-${p.category}`,
        title: p.buildTitle(body),
        category: p.category,
        urgency,
        originatorId: detectOriginatorId(speakerId),
        suggestedOwnerId: p.suggestedOwnerId,
        suggestionReason: p.suggestionReason,
        requiredProof: p.requiredProof,
        aiExplanation: `命中关键词：${matched.map((r) => r.source).join('、')}。`,
        matchedLine: line,
        matchedKeywords: matched.map((r) => r.source),
        confidence: Math.min(0.55 + matched.length * 0.15, 0.95),
      })
    })
  })

  const deduped = new Map<string, CapturedTask>()
  results.forEach((r) => {
    const key = r.category + r.title
    const prev = deduped.get(key)
    if (!prev || prev.confidence < r.confidence) deduped.set(key, r)
  })
  return Array.from(deduped.values())
}

/* -------------------------------------------------------------------------- */
/* 远程 · DeepSeek                                                            */
/* -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = `你是「后台审计」的家庭任务识别 Agent。

# 服务对象
夹心层照护者（典型如 36 岁的唐宁）—— 上有需要复诊和配药的老人、下有需要临时接送或交手工的孩子、中间还有伴侣和工作。
她不需要别人帮她记得"做饭"和"送孩子上学"，那些她和家里都有自己的节奏。
她真正会在凌晨三点醒来想起的，是那些 **没在日历上、却漏了就出事** 的事。

# 范围 · 我们只识别哪种任务
我们只识别 **一次性、有截止、有完成证明** 的"episodic"任务。

✅ 应该识别：
- 老人药品补货（不定期、量见底就要补）
- 复诊 / 体检 / 检查（指定日期）
- 临时学校通知（家长会、亲子手工、临时假）
- 物业 / 行政（年检、续费、更新证件）
- 报销 / 票据整理
- 偶发的家人请求（妈妈说血压表电池没了 / 老家亲戚要寄药）

❌ **绝对不要识别为任务**（这些是 routine，不在我们的范围）：
- 每天做饭 / 早饭午饭晚饭 / 煮汤
- 每天送孩子上学 / 接孩子放学
- 每天倒垃圾 / 洗碗 / 拖地 / 洗衣服 / 收衣服
- 每天 / 每周打扫
- 每天给孩子洗澡 / 哄睡 / 讲故事
- 散步 / 遛狗 / 运动
- 每天吃药（routine 部分，pill organizer 解决；只有"药没了要补"才是任务）
- 例行的家庭群闲聊 / 表情包 / 嘘寒问暖 / "你怎么还没睡"
- 单纯的情绪表达 / 抱怨 / 关心 / 没有具体行动指向的句子

判断标准（拿不准时用这条）：
**这件事如果漏了，三天后会出事吗？** 是 → 是任务。否 → 是日常，跳过。

# 重要：模糊承接的处理
- 一句随口的"你爸药快没了"是任务（即使没人说"请做 X"），分类 elderly_care，紧急 high。
- "收到 / 好的 / ok / 嗯" 这种回复 **不算正式承接**，相关任务标记为 "缺截止 + 缺证明"。
- 不要因为有人回复"收到"就跳过这个任务 —— 那种回复正是问题本身。

# 分类（固定枚举）
elderly_care     · 老人照护（药品、血压、复诊等）
medical          · 医疗复诊
child_school     · 孩子学校
household_admin  · 物业 / 家务行政
reimbursement    · 票据报销
general_family   · 偶发家事（不是 routine 的那种）

# 紧急程度
urgency: low / medium / high

# 推荐执行人（固定 ID）
- tangning · 唐宁主用户，本周心智负担已高，**尽量不要默认派给她**
- zhou     · 周勉（丈夫，与唐宁同城上海，处理家中事务）
- bro      · 弟弟（与父母同城南京，处理老人现场事务）
- mom      · 妈妈
- dad      · 爸爸

# 输出 · 严格 JSON
{
  "tasks": [
    {
      "title": "爸爸降压药补货",
      "category": "elderly_care",
      "urgency": "high",
      "dueDateText": "明天中午前",
      "suggestedOwnerId": "bro",
      "suggestionReason": "弟弟同城，可线下取药",
      "requiredProof": ["药品照片", "订单截图"],
      "matchedLine": "妈妈：你爸药快没了。",
      "aiExplanation": "一句随口的话，但药不能断；同时要求截止时间 + 证明",
      "confidence": 0.92
    }
  ]
}

如果文本里只有 routine（做饭、接送、闲聊），返回 { "tasks": [] }。
不要为了凑数而把日常包装成任务。
不要添加任何 JSON 之外的解释文字。`

async function callDeepSeekForCapture(input: string): Promise<CapturedTask[]> {
  const raw = await callDeepSeek({
    system: SYSTEM_PROMPT,
    user: input,
    json: true,
    temperature: 0.2,
  })
  const parsed = extractJson<{ tasks: Partial<CapturedTask>[] }>(raw)
  if (!parsed?.tasks?.length) return []
  return parsed.tasks.map(
    (t, idx): CapturedTask => ({
      id: `ds-${idx}-${Date.now()}`,
      title: t.title ?? '未命名任务',
      category: (t.category as TaskCategory) ?? 'general_family',
      urgency: (t.urgency as Urgency) ?? 'medium',
      originatorId: t.originatorId ?? 'system',
      suggestedOwnerId: t.suggestedOwnerId,
      suggestionReason: t.suggestionReason,
      requiredProof: t.requiredProof ?? [],
      aiExplanation: t.aiExplanation,
      dueDateText: t.dueDateText,
      matchedLine: t.matchedLine ?? '',
      matchedKeywords: [],
      confidence: typeof t.confidence === 'number' ? t.confidence : 0.85,
    }),
  )
}

export async function analyzeFamilyMessages(
  input: string,
): Promise<LLMResponse<CapturedTask[]>> {
  return callRemoteWithFallback({
    fallback: captureTasksFromMessages(input),
    mockNote: '本地关键词识别 · 没有可用 LLM',
    remote: () => callDeepSeekForCapture(input),
  })
}
