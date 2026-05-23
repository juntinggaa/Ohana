/**
 * Agent · Family Memory Chat
 *
 * 每个家人都可以告诉 AI 一句话；AI 先判断它应该成为任务、家庭记忆、
 * 可用性更新、问题，还是重新分担请求。
 *
 * 两种家庭场景：
 *   - sample family（示例 · 唐宁家） · 包含 'tangning' · 走原来的剧本化回复
 *   - own family（用户自己的家）         · 不在剧本里 · 回复用用户实际家人 ·
 *                                          不强行把每句话都变成任务
 */

import { newId } from '../utilsId'
import { recommendOwner } from './assignmentAgent'
import type {
  CareTask,
  FamilyMember,
  FamilyMemoryEntry,
  FamilyMemoryIntent,
  SuggestedAction,
  TaskCategory,
} from '../types'

/* -------------------------------------------------------------------------- */
/* Family-shape helpers                                                        */
/* -------------------------------------------------------------------------- */

function isSampleFamily(members: FamilyMember[]): boolean {
  return members.some((m) => m.id === 'tangning')
}

function memberName(id: string | undefined, members: FamilyMember[]): string {
  if (!id) return ''
  return members.find((m) => m.id === id)?.name ?? ''
}

/* -------------------------------------------------------------------------- */
/* Category & title inference                                                  */
/* -------------------------------------------------------------------------- */

interface CategoryRule {
  category: TaskCategory
  match: RegExp
  /** Default subtasks if the input matches this category */
  defaultSubtasks?: string[]
  /** Default due-date hint */
  defaultDeadline?: string
  /** Whether this is a health-monitoring signal (vs. a normal task) */
  riskSignal?: boolean
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'elderly_care',
    match: /血压|高压|低压|头晕|心跳|胸闷|心悸|血糖/,
    riskSignal: true,
    defaultSubtasks: [
      '未来 7 天每天早晚记录一次',
      '每次拍一张读数照片',
      '若超出正常范围，及时陪诊',
    ],
    defaultDeadline: '未来 7 天每天',
  },
  {
    category: 'elderly_care',
    match: /药.*没|药.*快|缺药|配药|开药|拿药|取药/,
    defaultSubtasks: ['确认药名 / 剂量', '确认家里剩余', '今晚前买好', '拍照发家庭群'],
    defaultDeadline: '今晚前',
  },
  {
    category: 'medical',
    match: /复诊|门诊|挂号|医院|看病|体检|检查|预约|手术/,
    defaultSubtasks: [
      '前一晚 22:00 后空腹（如需要）',
      '准备医保卡 / 文件袋 / 既往记录',
      '当天准时到医院',
      '处方与缴费单拍照发家庭群',
    ],
    defaultDeadline: '到预约日',
  },
  {
    category: 'household_admin',
    match: /燃气|物业|年检|续费|证件|水表|电表|缴费|账单|装修|维修/,
    defaultSubtasks: ['查时段 / 预约', '到时间在家接师傅', '上传单据 / 完成照片'],
    defaultDeadline: '本周内',
  },
  {
    category: 'child_school',
    match: /学校|幼儿园|老师|家长|手工|作品|班级|家委|作业|开学|放学|接娃/,
    defaultSubtasks: ['确认老师要求', '准备材料 / 作品', '当日按时送到', '现场拍照发家庭群'],
    defaultDeadline: '到截止日',
  },
  {
    category: 'reimbursement',
    match: /报销|发票|票据|医保|社保|账单整理/,
    defaultSubtasks: ['收集所有票据', '按类整理', '提交报销系统'],
    defaultDeadline: '本周内',
  },
]

function inferCategoryRule(text: string): CategoryRule | null {
  return CATEGORY_RULES.find((r) => r.match.test(text)) ?? null
}

/** 把一句口语化的描述提炼成一个 ≤ 18 字的任务标题。 */
function extractTitle(raw: string, ruleCategory: TaskCategory | null): string {
  let text = raw
    // 砍掉常见客套 / 语气词
    .replace(/^(请帮我|帮我|麻烦|可不可以|可以吗|能不能|想问一下|我想|我要|我觉得|你说|那个|嗯|呃)/, '')
    .replace(/[?？!！。、，,.]+$/, '')
    .trim()
  // 多句的话，取第一句
  const firstSentence = text.split(/[。！？!?\n]/)[0]?.trim()
  if (firstSentence) text = firstSentence
  // 限长
  if (text.length > 18) text = text.slice(0, 17) + '…'
  if (text.length === 0) {
    // 极端 fallback —— 给一个 category 友好的标题
    const dict: Record<TaskCategory, string> = {
      elderly_care: '家里的事 · 老人',
      medical: '家里的事 · 医疗',
      child_school: '家里的事 · 孩子学校',
      household_admin: '家里的事 · 家务行政',
      reimbursement: '家里的事 · 报销',
      general_family: '家里的事',
    }
    return dict[ruleCategory ?? 'general_family']
  }
  return text
}

/* -------------------------------------------------------------------------- */
/* Reply generation                                                            */
/* -------------------------------------------------------------------------- */

interface ReplyCtx {
  speaker: FamilyMember | undefined
  ownerName: string
  ruleCategory: TaskCategory | null
  riskSignal: boolean
  isSample: boolean
  title: string
  intent: FamilyMemoryIntent
}

function generateReply(ctx: ReplyCtx): string {
  const { speaker, ownerName, ruleCategory, riskSignal, isSample, title, intent } = ctx
  const who = speaker?.name ?? ''
  const owner = ownerName || '家人'

  // Sample 家庭（唐宁家） · 用原来更"剧本化"的语气
  if (isSample) {
    if (riskSignal)
      return `我帮你整理好了：这可能需要持续记录。${who ? who + '可以' : ''}每天拍一张读数，${owner}陪诊，唐宁只看汇总。`
    if (ruleCategory === 'elderly_care')
      return `知道了。我把它存成"${title}"，建议${owner}处理，今晚前完成。`
    if (ruleCategory === 'medical')
      return `好，复诊任务我建好了。陪诊默认派给${owner}，前一晚记得提醒。`
    if (ruleCategory === 'household_admin')
      return `这件事我交给${owner}，本周内能完成。`
    if (ruleCategory === 'child_school')
      return `孩子学校的事我建好了，建议交给${owner}，第二天早上直接到班级门口。`
    if (ruleCategory === 'reimbursement')
      return `报销整理我交给${owner}，本周内完成。`
    return `我把它存成"${title}"，建议交给${owner}。`
  }

  // 用户自己的家 · 更克制的中性回复，不剧本化
  if (intent === 'availability_update')
    return `收到，我把这句话当成可用时间/限制来记。之后分配任务时，会优先参考它。`
  if (intent === 'redistribution_request')
    return `我明白了：这不是新增一件事，而是需要把责任重新分出去。我会把它记成一次分担请求。`
  if (intent === 'question')
    return `我先把你的问题记下来：${title}。如果它需要家人跟进，也可以转成任务。`
  if (intent === 'care_note')
    return `我先把它作为家庭记忆保存：${title}。它不一定要变成任务。`
  if (riskSignal)
    return `我帮你整理成一件事：${title}。${owner ? '建议先记下来 · 由 ' + owner + ' 跟进。' : '看看要不要建任务。'}`
  if (ruleCategory)
    return `好，我整理成了一件事：${title}。${owner ? '建议交给 ' + owner + '。' : ''}`
  // 完全没匹配 category —— 仍然建任务
  return `我整理成了一件事：${title}。看看下面对不对，要不要直接加进列表。`
}

/* -------------------------------------------------------------------------- */
/* Intent inference                                                            */
/* -------------------------------------------------------------------------- */

function inferIntent(
  text: string,
  matched: CategoryRule | null,
  riskSignal: boolean,
): FamilyMemoryIntent {
  if (/重新分配|重新安排|分担|别都让我|不要都让我|不想再负责|太累|换人/.test(text)) {
    return 'redistribution_request'
  }
  if (/有空|有时间|可以帮|我来|我能|没空|不方便|不在|出差|请假|周[一二三四五六日天].*(可以|有空|没空|不方便)/.test(text)) {
    return 'availability_update'
  }
  if (riskSignal) return 'risk_signal'
  if (matched) return 'new_task'
  if (/[?？]|怎么办|怎么做|要带什么|要紧吗|可以吗|需要吗|谁来/.test(text)) {
    return 'question'
  }
  return 'care_note'
}

function shouldOfferPrimaryTask(intent: FamilyMemoryIntent): boolean {
  return (
    intent === 'new_task' ||
    intent === 'risk_signal' ||
    intent === 'redistribution_request'
  )
}

function createTaskAction(args: {
  label: string
  title: string
  category: TaskCategory
  ownerId?: string
  subtasks?: string[]
  deadline?: string
  reason?: string
  speakerId: string
  speakerName?: string
}): SuggestedAction {
  return {
    id: newId('act'),
    label: args.label,
    actionType: 'create_task',
    payload: {
      title: args.title,
      category: args.category,
      suggestedOwnerId: args.ownerId,
      subtasks: args.subtasks ?? [],
      dueDateText: args.deadline,
      aiExplanation: args.reason,
      originatorId: args.speakerId,
      originatorLabel: args.speakerName,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export function processFamilyMemoryMessage(args: {
  speakerId: string
  rawMessage: string
  members: FamilyMember[]
  existingTasks: CareTask[]
}): FamilyMemoryEntry {
  const { speakerId, rawMessage, members, existingTasks } = args
  const trimmed = rawMessage.trim()
  const speaker = members.find((m) => m.id === speakerId)
  const isSample = isSampleFamily(members)

  // 空输入 —— 不可能走到这（UI 已禁用），但防御一下
  if (!trimmed) {
    return {
      id: newId('mem'),
      speakerId,
      rawMessage: trimmed,
      createdAt: Date.now(),
      intent: 'care_note',
      aiSummary: '说一句话再告诉我吧。',
      suggestedActions: [],
    }
  }

  // Step 1 · 试着匹配 category
  const matched = inferCategoryRule(trimmed)
  const category: TaskCategory = matched?.category ?? 'general_family'
  const explicitRisk =
    /偏高|偏低|有点高|太高|太低|头晕|胸闷|心悸|要紧|超过|[1-9]\d{2}\s*\/\s*\d{2}/.test(trimmed)
  const normalReading = /正常|稳定|还好|没事/.test(trimmed)
  const riskSignal = matched?.riskSignal === true && (explicitRisk || !normalReading)
  const matchedForIntent = matched?.riskSignal === true && !riskSignal ? null : matched

  // Step 2 · 提炼标题
  const title = extractTitle(trimmed, matched?.category ?? null)

  // Step 3 · 用 assignmentAgent 推荐执行人（基于 traits / city / capacity）
  const recommendation = recommendOwner({ category, title }, members)
  const ownerName = memberName(recommendation?.ownerId, members)

  // Step 4 · 是否能关联到已有任务（同前缀）
  const related = existingTasks.filter((t) =>
    t.title.length >= 3 && title.includes(t.title.slice(0, 3)),
  )

  // Step 5 · 决定 intent —— 影响 UI 上的标签与主按钮
  const intent = inferIntent(trimmed, matchedForIntent, riskSignal)

  // Step 6 · 生成 actions
  const actions: SuggestedAction[] = []
  if (shouldOfferPrimaryTask(intent)) {
    actions.push(
      createTaskAction({
        label:
          intent === 'risk_signal'
            ? ownerName
              ? `创建跟进任务并通知 ${ownerName}`
              : '创建跟进任务'
            : intent === 'redistribution_request'
              ? '创建一条分担讨论任务'
              : ownerName
                ? `创建任务并通知 ${ownerName}`
                : '创建任务',
        title: intent === 'redistribution_request' ? '重新分配家庭任务' : title,
        category,
        ownerId: recommendation?.ownerId,
        subtasks:
          intent === 'redistribution_request'
            ? ['列出现在没人接住的事', '重新确认每个人能做哪一部分', '发出新的承接卡片']
          : matchedForIntent?.defaultSubtasks ?? [],
        deadline: matchedForIntent?.defaultDeadline,
        reason:
          intent === 'redistribution_request'
            ? '有人提出需要重新分担，先把请求变成一条可讨论、可指派的事。'
            : recommendation?.reason,
        speakerId,
        speakerName: speaker?.name,
      }),
    )
  } else {
    actions.push({
      id: newId('act'),
      label:
        intent === 'availability_update'
          ? '记到家人状态'
          : intent === 'question'
            ? '先记下这个问题'
            : '记为家庭记忆',
      actionType: intent === 'availability_update' ? 'assign_owner' : 'notify_family',
      payload: {
        note_only: true,
        speakerId,
        rawMessage: trimmed,
      },
    })
    actions.push(
      createTaskAction({
        label: '还是转成任务',
        title,
        category,
        ownerId: recommendation?.ownerId,
        subtasks: matchedForIntent?.defaultSubtasks ?? [],
        deadline: matchedForIntent?.defaultDeadline,
        reason: recommendation?.reason,
        speakerId,
        speakerName: speaker?.name,
      }),
    )
  }
  if (related.length > 0) {
    actions.push({
      id: newId('act'),
      label: `更新现有任务（${related[0].title}）`,
      actionType: 'update_task',
      payload: { taskId: related[0].id },
    })
  }
  if (shouldOfferPrimaryTask(intent)) {
    actions.push({
      id: newId('act'),
      label: '只记录，不建任务',
      actionType: 'notify_family',
      payload: { note_only: true, speakerId, rawMessage: trimmed },
    })
  }
  actions.push({ id: newId('act'), label: '忽略', actionType: 'ignore' })

  return {
    id: newId('mem'),
    speakerId,
    rawMessage: trimmed,
    createdAt: Date.now(),
    intent,
    aiSummary: generateReply({
      speaker,
      ownerName,
      ruleCategory: matchedForIntent?.category ?? null,
      riskSignal,
      isSample,
      title,
      intent,
    }),
    extractedTitle: title,
    suggestedOwnerId: shouldOfferPrimaryTask(intent) ? recommendation?.ownerId : undefined,
    suggestedSubtasks: matchedForIntent?.defaultSubtasks,
    suggestedDeadline: matchedForIntent?.defaultDeadline,
    relatedTaskIds: related.map((t) => t.id),
    suggestedActions: actions,
  }
}
