/**
 * Agent · Family Memory Chat
 *
 * 每个家人都可以告诉 AI 一句话；AI 把"散落的家庭记忆"整理成：
 *   - 新任务建议
 *   - 风险信号
 *   - 可用时段
 *   - 关心提醒
 *   - 重新分配请求
 *
 * 完全确定性的 mock —— 关键词 + 简单规则。够 demo + 给真 LLM 留接口。
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
/* Intent classification                                                      */
/* -------------------------------------------------------------------------- */

interface Rule {
  intent: FamilyMemoryIntent
  match: RegExp
  /** Optionally infer a task title / category if this is a new_task */
  taskCategory?: TaskCategory
  buildTitle?: (rawMessage: string) => string
  /** A short reply the AI says back to the speaker */
  reply: (ctx: { speaker: FamilyMember | undefined; raw: string }) => string
  /** Extra suggested subtasks */
  subtasks?: string[]
  /** Suggested deadline text */
  suggestedDeadline?: string
}

const RULES: Rule[] = [
  // 健康监测信号
  {
    intent: 'risk_signal',
    match: /血压|高压|低压|头晕|心跳|胸闷/,
    taskCategory: 'elderly_care',
    buildTitle: () => '爸爸/妈妈血压记录跟踪',
    reply: ({ speaker }) =>
      `我帮你整理好了：这可能需要记录血压。${speaker?.name ?? ''}可以每天拍一张血压记录，弟弟陪诊，唐宁只看汇总。`,
    subtasks: [
      '未来 7 天每天早晚记录血压',
      '每天拍一张血压计读数照片',
      '若任何一天 ≥150/95，立即提醒弟弟陪诊',
    ],
    suggestedDeadline: '未来 7 天每天',
  },
  // 药品 / 配药
  {
    intent: 'new_task',
    match: /药.*没|药.*快|缺药|配药|开药/,
    taskCategory: 'elderly_care',
    buildTitle: () => '老人药品补货',
    reply: () => `知道了。我把它存成"老人药品补货"，建议同城的弟弟去取，今天晚上前完成。`,
    subtasks: [
      '确认药品名称与剂量',
      '确认家里剩余数量',
      '今晚前完成购买',
      '上传药品照片到家庭群',
    ],
    suggestedDeadline: '今天晚上前',
  },
  // 复诊 / 检查
  {
    intent: 'new_task',
    match: /复诊|门诊|检查|挂号|医院/,
    taskCategory: 'medical',
    buildTitle: () => '医院复诊安排',
    reply: () => `好，复诊任务我建好了。陪诊默认派给弟弟，妈妈负责前一晚空腹提醒。`,
    subtasks: [
      '前一晚 22:00 后空腹',
      '准备医保卡 / 文件袋 / 血压记录本',
      '当天 8:20 到医院门口',
      '问医生：近一周血压、是否调药、下次复诊',
      '处方与缴费单拍照发家庭群',
    ],
    suggestedDeadline: '下次预约日',
  },
  // 家务行政 / 燃气 / 物业
  {
    intent: 'new_task',
    match: /燃气|物业|年检|续费|证件|水表|电表/,
    taskCategory: 'household_admin',
    buildTitle: () => '家务行政事项',
    reply: () => `这件事我交给周勉，他比较稳，本周内能完成。`,
    subtasks: [
      '查公众号或物业群预约时段',
      '选定周五下午 / 周末',
      '当天在家接师傅',
      '上传合格证 / 完成单据照片',
    ],
    suggestedDeadline: '本周内',
  },
  // 学校 / 孩子
  {
    intent: 'new_task',
    match: /学校|幼儿园|老师|家长|手工|作品|班级|家委/,
    taskCategory: 'child_school',
    buildTitle: () => '孩子学校任务',
    reply: () => `孩子学校的事我建好了，建议交给周勉，第二天早上他可以直接到班级门口。`,
    subtasks: [
      '查清楚老师的具体要求',
      '准备材料 / 作品',
      '当日按时送到',
      '现场拍照发家庭群',
    ],
    suggestedDeadline: '明天上学前',
  },
  // 可用时段 / availability
  {
    intent: 'availability_update',
    match: /我.*?(周|周末|今天|明天|后天|这周|下周).*?(有空|可以|在家|没事)/,
    reply: ({ speaker }) =>
      `知道了，我记下来 —— ${speaker?.name ?? '你'}最近有时段。下次有合适的事我优先派给你，并把这件事先标给你做候选。`,
  },
  // 重新分配请求
  {
    intent: 'redistribution_request',
    match: /重新分配|不想再|帮我.*分配|分担|交出|交给别人|交出去/,
    reply: () =>
      `好，我重新算了一下：医疗跑腿 → 弟弟，拍照确认 → 妈妈，报销整理 → 唐宁（每周三晚），家务行政 → 周勉。要不要我现在去群里发一遍？`,
  },
  // 关心 / 笼统 care note
  {
    intent: 'care_note',
    match: /担心|怕|要不要|是不是|你说/,
    reply: () => `我记下了。如果它演变成具体的事，我会再来找你确认。`,
  },
  // 问题
  {
    intent: 'question',
    match: /怎么办|要带什么|带什么|怎么准备|带哪些|要不要带/,
    reply: () =>
      `要带这几样：医保卡、文件袋、血压记录本、口罩。回来时记得拍处方和缴费单。`,
  },
]

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
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

  // 找命中的 rule —— 第一条命中即可
  const rule = RULES.find((r) => r.match.test(trimmed))

  if (!rule) {
    return {
      id: newId('mem'),
      speakerId,
      rawMessage: trimmed,
      createdAt: Date.now(),
      intent: 'care_note',
      aiSummary: `我先记下来了。${speaker?.name ?? ''}你说的这件事，等出现具体动作，我会再来问你要不要建任务。`,
      suggestedActions: [
        { id: newId('act'), label: '忽略 / 只记录', actionType: 'ignore' },
      ],
    }
  }

  const recommendation =
    rule.taskCategory && rule.buildTitle
      ? recommendOwner({ category: rule.taskCategory, title: rule.buildTitle(trimmed) }, members)
      : null

  // 关联现有任务（如果有同标题的）
  const titleHint = rule.buildTitle?.(trimmed)
  const related = titleHint
    ? existingTasks.filter((t) => t.title.includes(titleHint.slice(0, 4)))
    : []

  const actions: SuggestedAction[] = []
  const recoName = recommendation?.ownerId
    ? members.find((m) => m.id === recommendation.ownerId)?.name
    : undefined

  if (rule.intent === 'new_task' || rule.intent === 'risk_signal') {
    actions.push({
      id: newId('act'),
      label: recoName ? `创建任务并通知 ${recoName}` : '创建任务',
      actionType: 'create_task',
      payload: {
        title: titleHint ?? '家庭事项',
        category: rule.taskCategory,
        suggestedOwnerId: recommendation?.ownerId,
        subtasks: rule.subtasks ?? [],
        dueDateText: rule.suggestedDeadline,
        aiExplanation: rule.reply({ speaker, raw: trimmed }),
        originatorId: speakerId,
        originatorLabel: speaker?.name,
      },
    })
    if (related.length > 0) {
      actions.push({
        id: newId('act'),
        label: `更新现有任务（${related[0].title}）`,
        actionType: 'update_task',
        payload: { taskId: related[0].id },
      })
    }
    actions.push({
      id: newId('act'),
      label: '只记录，不建任务',
      actionType: 'notify_family', // 复用 enum，UI 显示 noted 状态
      payload: { note_only: true },
    })
  } else if (rule.intent === 'availability_update') {
    actions.push({
      id: newId('act'),
      label: '把这段时间标记为可承接',
      actionType: 'assign_owner',
      payload: { ownerId: speakerId },
    })
  } else if (rule.intent === 'redistribution_request') {
    actions.push({
      id: newId('act'),
      label: '应用 AI 重新分配建议',
      actionType: 'update_task',
      payload: { redistribute: true },
    })
  }

  actions.push({ id: newId('act'), label: '忽略', actionType: 'ignore' })

  return {
    id: newId('mem'),
    speakerId,
    rawMessage: trimmed,
    createdAt: Date.now(),
    intent: rule.intent,
    aiSummary: rule.reply({ speaker, raw: trimmed }),
    extractedTitle: titleHint,
    suggestedOwnerId: recommendation?.ownerId,
    suggestedSubtasks: rule.subtasks,
    suggestedDeadline: rule.suggestedDeadline,
    relatedTaskIds: related.map((t) => t.id),
    suggestedActions: actions,
  }
}
