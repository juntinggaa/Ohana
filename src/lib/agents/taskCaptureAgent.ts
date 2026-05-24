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

import { recommendOwner } from './assignmentAgent'
import type { FamilyMember, TaskCategory, Urgency } from '../types'
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

export interface CaptureContext {
  members?: FamilyMember[]
  currentUserId?: string
}

interface Pattern {
  match: RegExp[]
  category: TaskCategory
  urgency: Urgency
  buildTitle: (text: string) => string
  requiredProof?: string[]
}

const PATTERNS: Pattern[] = [
  {
    match: [/药.*没/, /药.*快/, /处方/, /开药/, /配药/],
    category: 'elderly_care',
    urgency: 'high',
    buildTitle: () => '为长辈补好药品',
    requiredProof: ['药品照片', '小票或订单截图'],
  },
  {
    match: [/复诊/, /门诊/, /挂号/, /高血压/, /心电/, /检查/],
    category: 'medical',
    urgency: 'high',
    buildTitle: () => '陪家人安心复诊',
    requiredProof: ['处方照片', '缴费单照片'],
  },
  {
    match: [/燃气/, /物业/, /年检/, /电表/, /水表/],
    category: 'household_admin',
    urgency: 'medium',
    buildTitle: () => '家中检修提醒',
    requiredProof: ['合格证或完成单据照片'],
  },
  {
    match: [/幼儿园/, /学校/, /家长/, /手工/, /作品/, /家委/, /班级/],
    category: 'child_school',
    urgency: 'medium',
    buildTitle: () => '陪孩子准备学校活动',
    requiredProof: ['完成现场照片'],
  },
  {
    match: [/报销/, /发票/, /缴费/, /票据/],
    category: 'reimbursement',
    urgency: 'low',
    buildTitle: () => '留好家中的票据',
  },
]

function detectUrgency(text: string, base: Urgency): Urgency {
  if (/今天|马上|快|紧急|立刻/.test(text)) return 'high'
  if (/本周|明天|后天/.test(text)) return base === 'low' ? 'medium' : base
  return base
}

function findMemberBySpeakerLabel(
  label: string,
  members: FamilyMember[] = [],
): FamilyMember | undefined {
  const clean = label.replace(/\[[^\]]+\]/g, '').trim()
  return members.find((m) => {
    const relation = m.relation.replace('我自己', '').trim()
    return (
      clean.includes(m.name) ||
      (relation.length > 0 && clean.includes(relation))
    )
  })
}

function detectOriginatorId(label: string, context: CaptureContext): string {
  const member = findMemberBySpeakerLabel(label, context.members)
  if (member) return member.id
  return context.currentUserId ?? 'system'
}

function recommendForCapturedTask(
  category: TaskCategory,
  title: string,
  context: CaptureContext,
) {
  const members = context.members ?? []
  if (members.length === 0) return null
  return recommendOwner({ category, title }, members)
}

function parseSpeakerLine(line: string): { speakerLabel: string; body: string } {
  const speakerMatch = line.match(/([^[\]:：]+)[：:]\s*(.*)$/)
  return {
    speakerLabel: speakerMatch?.[1]?.trim() ?? '',
    body: (speakerMatch?.[2] ?? line).trim(),
  }
}

function medicineAlreadyOrdered(input: string): boolean {
  const hasMedicineNeed = /药.{0,8}(快|没|不多|见底)|药快没了/.test(input)
  const hasOrder = /(我先|已经|已|帮忙|帮).{0,6}下单|下单了|买好了|已买|已经买/.test(input)
  const hasArrival = /(今天|明天|后天).{0,10}到|到货|送达|签收/.test(input)
  return hasMedicineNeed && hasOrder && hasArrival
}

function dueTextFromDeliveryLine(line: string): string | undefined {
  if (/明天中午前到/.test(line)) return '明天中午前'
  if (/明天.*到/.test(line)) return '明天'
  if (/今天.*到/.test(line)) return '今天'
  return undefined
}

function receiptConfirmer(context: CaptureContext): FamilyMember | undefined {
  const members = context.members ?? []
  return (
    members.find((m) => /妈妈|母亲/.test(`${m.name} ${m.relation}`)) ??
    members.find((m) => /爸爸|父亲/.test(`${m.name} ${m.relation}`))
  )
}

function isMedicationReceiptTask(title: string, matchedLine?: string, explanation?: string): boolean {
  return /确认.*药.*(收到|送达|签收)|药.*(收到|送达|签收)/.test(
    `${title} ${matchedLine ?? ''} ${explanation ?? ''}`,
  )
}

/**
 * 本地确定性识别 —— 没 key 或远程挂掉时使用。
 */
export function captureTasksFromMessages(
  input: string,
  context: CaptureContext = {},
): CapturedTask[] {
  const lines = input
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const results: CapturedTask[] = []
  const hasMedicineReceiptOnly = medicineAlreadyOrdered(input)

  if (hasMedicineReceiptOnly) {
    const orderIdx = lines.findIndex((line) => /下单|买好|到货|送达|签收/.test(line))
    const matchedLine = lines[orderIdx] ?? lines.find((line) => /药/.test(line)) ?? input
    const { speakerLabel } = parseSpeakerLine(matchedLine)
    const confirmer = receiptConfirmer(context)
    results.push({
      id: `cap-${Math.max(orderIdx, 0)}-elderly_care-receipt`,
      title: '确认爸爸降压药已收到',
      category: 'elderly_care',
      urgency: 'medium',
      originatorId: detectOriginatorId(speakerLabel, context),
      suggestedOwnerId: confirmer?.id,
      suggestionReason: confirmer
        ? `唐宁已经下单；可以问问${confirmer.name}是否方便在家确认收到并拍张照片，让大家安心。`
        : '唐宁已经下单，当前只需要确认药送到父母手上。',
      requiredProof: ['药品照片或签收截图'],
      aiExplanation:
        '药已经下单了，现在只需要有人轻轻确认它按时送到父母手上。',
      dueDateText: dueTextFromDeliveryLine(matchedLine),
      matchedLine,
      matchedKeywords: ['药快没了', '下单', '到'],
      confidence: 0.92,
    })
  }

  lines.forEach((line, idx) => {
    const { speakerLabel, body } = parseSpeakerLine(line)

    PATTERNS.forEach((p) => {
      const matched = p.match.filter((re) => re.test(body))
      if (matched.length === 0) return
      if (hasMedicineReceiptOnly && p.category === 'elderly_care' && /药/.test(body)) return
      const urgency = detectUrgency(body, p.urgency)
      const title = p.buildTitle(body)
      const recommendation = recommendForCapturedTask(p.category, title, context)

      results.push({
        id: `cap-${idx}-${p.category}`,
        title,
        category: p.category,
        urgency,
        originatorId: detectOriginatorId(speakerLabel, context),
        suggestedOwnerId: recommendation?.ownerId,
        suggestionReason: recommendation?.reason,
        requiredProof: p.requiredProof,
        aiExplanation: `从消息里注意到：${matched.map((r) => r.source).join('、')}。这件事也许值得家人一起留意。`,
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

function buildSystemPrompt(context: CaptureContext): string {
  const members = context.members ?? []
  const memberList =
    members.length > 0
      ? members
          .map((m) => {
            const bits = [m.relation, m.city, m.capacity, ...(m.traits ?? [])].filter(Boolean)
            return `- ${m.id} · ${m.name}${bits.length ? `（${bits.join(' / ')}）` : ''}`
          })
          .join('\n')
      : '- 当前没有固定成员；suggestedOwnerId 可以留空。'

  return `你是「欧哈娜 Ohana」的家庭任务识别 Agent。

# 服务对象
一个真实家庭。不要套用任何示例家庭、固定姓名或固定角色。
你的目标是把散落在家庭群、医院提醒、学校通知、物业短信里的信息，整理成少量真正需要被接住的事。

# 范围 · 我们只识别哪种任务
我们只识别 **一次性、有截止、有完成证明** 的"episodic"任务。

✅ 应该识别：
- 老人药品补货（不定期、量见底就要补）
- 复诊 / 体检 / 检查（指定日期）
- 临时学校通知（家长会、亲子手工、临时假）
- 物业 / 行政（年检、续费、更新证件）
- 报销 / 票据整理
- 偶发的家人请求（药快没了 / 血压表电池没了 / 老家亲戚要寄药）

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
- 如果同一段消息里先说"药快没了"，后面又说"我先/已经下单了，明天...到"，说明买药动作已完成：
  - 不要输出"老人药品补货"；
  - 不要推荐弟弟去买药；
  - 只输出一个"确认爸爸降压药已收到/送达"类任务，suggestedOwnerId 优先给在家能拍照确认的妈妈/老人，不确定可留空。

# 分类（固定枚举）
elderly_care     · 老人照护（药品、血压、复诊等）
medical          · 医疗复诊
child_school     · 孩子学校
household_admin  · 物业 / 家务行政
reimbursement    · 票据报销
general_family   · 偶发家事（不是 routine 的那种）

# 紧急程度
urgency: low / medium / high

# 可用家庭成员（suggestedOwnerId 只能从这里选）
${memberList}

推荐执行人规则：
- 只能使用上面列出的 id；不确定就留空。
- 医疗 / 老人现场事务：优先推荐与被照护者同城、能跑腿/陪诊/拍照的人。
- 孩子学校事务：优先推荐与孩子或学校同城、日历可控的人。
- 家务行政：优先推荐能对接师傅、日历可靠、与住处同城的人。
- 不要把任务默认推给一个固定主用户；要根据真实成员资料判断。

# 输出 · 严格 JSON
{
  "tasks": [
    {
      "title": "老人药品补货",
      "category": "elderly_care",
      "urgency": "high",
      "dueDateText": "明天中午前",
      "suggestedOwnerId": "某个成员 id 或留空",
      "suggestionReason": "说明为什么这个人更合适",
      "requiredProof": ["药品照片", "订单截图"],
      "matchedLine": "原始句子",
      "aiExplanation": "一句随口的话，但药不能断；同时要求截止时间 + 证明",
      "confidence": 0.92
    }
  ]
}

如果文本里只有 routine（做饭、接送、闲聊），返回 { "tasks": [] }。
不要为了凑数而把日常包装成任务。
不要添加任何 JSON 之外的解释文字。`
}

async function callDeepSeekForCapture(
  input: string,
  context: CaptureContext,
): Promise<CapturedTask[]> {
  const raw = await callDeepSeek({
    system: buildSystemPrompt(context),
    user: input,
    json: true,
    temperature: 0.2,
  })
  const parsed = extractJson<{ tasks: Partial<CapturedTask>[] }>(raw)
  if (!parsed?.tasks?.length) return []
  const validOwnerIds = new Set((context.members ?? []).map((m) => m.id))
  const forceMedicineReceipt = medicineAlreadyOrdered(input)
  return parsed.tasks.map(
    (t, idx): CapturedTask => {
      const category = (t.category as TaskCategory) ?? 'general_family'
      const matchedLine = t.matchedLine ?? ''
      const shouldNormalizeMedicineReceipt =
        forceMedicineReceipt && category === 'elderly_care' && /药|补货/.test(`${t.title ?? ''} ${matchedLine}`)
      const title = shouldNormalizeMedicineReceipt ? '确认爸爸降压药已收到' : (t.title ?? '未命名任务')
      const confirmer = shouldNormalizeMedicineReceipt ? receiptConfirmer(context) : undefined
      const fallbackReco = recommendForCapturedTask(category, title, context)
      const avoidAutoOwner = isMedicationReceiptTask(title, matchedLine, t.aiExplanation)
      const remoteOwner =
        !shouldNormalizeMedicineReceipt && t.suggestedOwnerId && validOwnerIds.has(t.suggestedOwnerId)
          ? t.suggestedOwnerId
          : undefined
      return {
        id: `ds-${idx}-${Date.now()}`,
        title,
        category,
        urgency: (t.urgency as Urgency) ?? 'medium',
        originatorId:
          t.originatorId && validOwnerIds.has(t.originatorId)
            ? t.originatorId
            : context.currentUserId ?? 'system',
        suggestedOwnerId: remoteOwner ?? confirmer?.id ?? (avoidAutoOwner ? undefined : fallbackReco?.ownerId),
        suggestionReason:
          shouldNormalizeMedicineReceipt
            ? confirmer
              ? `唐宁已经下单，不需要再派弟弟买药；${confirmer.name}在家确认收到并拍照反馈就好。`
              : '唐宁已经下单，当前只需要确认药送到父母手上。'
            : t.suggestionReason ?? (avoidAutoOwner ? undefined : fallbackReco?.reason),
        requiredProof: shouldNormalizeMedicineReceipt ? ['药品照片或签收截图'] : (t.requiredProof ?? []),
        aiExplanation:
          shouldNormalizeMedicineReceipt
            ? '唐宁已经下单，当前只需要确认药送到父母手上。'
            : t.aiExplanation,
        dueDateText: t.dueDateText ?? (shouldNormalizeMedicineReceipt ? dueTextFromDeliveryLine(matchedLine) : undefined),
        matchedLine,
        matchedKeywords: [],
        confidence: typeof t.confidence === 'number' ? t.confidence : 0.85,
      }
    },
  )
}

export async function analyzeFamilyMessages(
  input: string,
  context: CaptureContext = {},
): Promise<LLMResponse<CapturedTask[]>> {
  return callRemoteWithFallback({
    fallback: captureTasksFromMessages(input, context),
    mockNote: '本地关键词识别 · 没有可用 LLM',
    remote: () => callDeepSeekForCapture(input, context),
  })
}
