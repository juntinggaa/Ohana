import type {
  CareTask,
  FamilyMember,
  RawMessage,
  ResponsibilityRisk,
  WeeklyMentalLoadSnapshot,
} from './types'
import { buildSnapshot } from './mentalLoad'

/* -------------------------------------------------------------------------- */
/* 家庭成员 · Family Members                                                  */
/* -------------------------------------------------------------------------- */

export const FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: 'tangning',
    name: '唐宁',
    relation: '我',
    avatarColor: 'bg-ember-600 text-white',
    city: '上海',
    capacity: 'busy',
    notes: '夹心层照护者 · 36 岁 · 互联网运营经理',
    traits: ['统筹', '票据整理', '医疗行政', '已超载'],
    uiMode: 'standard',
  },
  {
    id: 'mom',
    name: '妈妈',
    relation: '母亲',
    avatarColor: 'bg-ink-700 text-white',
    city: '南京',
    capacity: 'flexible',
    notes: '63 岁 · 高血压 · 常说"没事"',
    traits: ['在家时间多', '会拍照', '了解爸爸状况', '不太会用 App'],
    uiMode: 'elder',
  },
  {
    id: 'dad',
    name: '爸爸',
    relation: '父亲',
    avatarColor: 'bg-ink-400 text-white',
    city: '南京',
    capacity: 'flexible',
    notes: '64 岁 · 高血压复诊中',
    traits: ['被照护对象', '需要陪诊', '血压监测中'],
    uiMode: 'elder',
  },
  {
    id: 'bro',
    name: '弟弟',
    relation: '弟弟',
    avatarColor: 'bg-moss-600 text-white',
    city: '南京',
    capacity: 'medium',
    notes: '31 岁 · 与父母同城 · 习惯被安排好以后执行',
    traits: ['同城父母', '可跑腿', '会陪诊', '能买药', '不擅长发起'],
    uiMode: 'standard',
  },
  {
    id: 'zhou',
    name: '周勉',
    relation: '丈夫',
    avatarColor: 'bg-moss-400 text-white',
    city: '上海',
    capacity: 'medium',
    notes: '38 岁 · 愿意帮忙 · 但只做被明说出来的事',
    traits: ['同城唐宁', '家务行政', '日历可靠', '可对接师傅', '能拍照上传'],
    uiMode: 'standard',
  },
  {
    id: 'kid',
    name: '小棠',
    relation: '孩子',
    avatarColor: 'bg-ember-300 text-ink-900',
    city: '上海',
    capacity: 'flexible',
    notes: '6 岁 · 幼儿园中班',
    traits: ['只能做简单事', '不可承接医疗 / 行政'],
    uiMode: 'elder',
  },
]

export function getMember(id: string): FamilyMember | undefined {
  return FAMILY_MEMBERS.find((m) => m.id === id)
}

/* -------------------------------------------------------------------------- */
/* 原始消息 · Raw Messages（混乱的家庭群、医院、学校、物业）                 */
/* -------------------------------------------------------------------------- */

export const RAW_MESSAGES: RawMessage[] = [
  {
    id: 'm1',
    speakerId: 'mom',
    speakerLabel: '妈妈',
    channel: '家庭群',
    timestamp: '昨天 17:08',
    body: '你爸药快没了。',
  },
  {
    id: 'm2',
    speakerId: 'bro',
    speakerLabel: '弟弟',
    channel: '家庭群',
    timestamp: '昨天 17:11',
    body: '收到。',
  },
  {
    id: 'm3',
    speakerId: 'tangning',
    speakerLabel: '唐宁',
    channel: '家庭群',
    timestamp: '昨天 22:46',
    body: '我先下单了，明天中午前到。',
  },
  {
    id: 'm4',
    speakerId: 'mom',
    speakerLabel: '妈妈',
    channel: '家庭群',
    timestamp: '昨天 22:51',
    body: '你怎么还没睡？别管了，早点睡。',
  },
  {
    id: 'm5',
    speakerId: 'system',
    speakerLabel: '幼儿园老师',
    channel: '幼儿园群',
    timestamp: '昨天 21:20',
    body: '明天请家长带孩子作品到班级门口拍照。',
  },
  {
    id: 'm6',
    speakerId: 'system',
    speakerLabel: '物业',
    channel: '物业通知',
    timestamp: '今天 09:02',
    body: '燃气年检请于本周内预约。',
  },
  {
    id: 'm7',
    speakerId: 'system',
    speakerLabel: '医院',
    channel: '医院提醒',
    timestamp: '今天 10:14',
    body: '高血压复诊预约：周一 9:20，请携带医保卡、检查单、血压记录本。前一晚 22:00 后空腹。',
  },
  {
    id: 'm8',
    speakerId: 'mom',
    speakerLabel: '妈妈',
    channel: '私聊',
    timestamp: '今天 11:30',
    body: '你爸今天早上血压 148/92，要紧吗？',
  },
]

export const FAMILY_CHAT_RAW = [
  '23 may 2026',
  '[家庭群] 昨天 17:08 · 妈妈：你爸药快没了。',
  '[家庭群] 昨天 17:11 · 弟弟：收到。',
  '[家庭群] 昨天 22:46 · 唐宁：我先下单了，明天中午前到。',
  '[家庭群] 昨天 22:51 · 妈妈：你怎么还没睡？别管了，早点睡。',
  '[幼儿园群] 昨天 21:20 · 幼儿园老师：明天请家长带孩子作品到班级门口拍照。',
  '24 may 2026',
  '[物业通知] 今天 09:02 · 物业：燃气年检请于本周内预约。',
  '[医院提醒] 今天 10:14 · 医院：高血压复诊预约：周一 9:20，请携带医保卡、检查单、血压记录本。前一晚 22:00 后空腹。',
  '[私聊] 今天 11:30 · 妈妈：你爸今天早上血压 148/92，要紧吗？',
].join('\n')

/* -------------------------------------------------------------------------- */
/* 任务示例 · 用于"识别后"的展示                                              */
/* -------------------------------------------------------------------------- */

export const SAMPLE_TASKS: CareTask[] = [
  {
    id: 't1',
    title: '爸爸降压药补货',
    category: 'elderly_care',
    sourceMessageIds: ['m1', 'm2', 'm3'],
    sourceSummary: '妈妈："你爸药快没了。" / 弟弟："收到。"',
    originatorId: 'mom',
    suggestedOwnerId: 'bro',
    suggestionReason:
      '弟弟与父母同城，到药店或线下取药成本最低。建议正式确认一下时间和完成证明。',
    dueDateText: '明天中午前',
    dueDate: '2026-05-24',
    status: 'pending_acceptance',
    urgency: 'high',
    subtasks: [
      { id: 's1', title: '确认药品名称与剂量', phase: 'before', completed: false },
      { id: 's2', title: '确认家里剩余数量', phase: 'before', completed: false },
      { id: 's3', title: '是否需要处方', phase: 'before', completed: false },
      { id: 's4', title: '线上下单或到店购买', phase: 'during', completed: false },
      { id: 's5', title: '上传药品照片到家庭群', phase: 'after', completed: false },
      { id: 's6', title: '设置下一次补货提醒', phase: 'after', completed: false },
    ],
    requiredProof: ['药品照片', '小票或订单截图'],
    aiExplanation:
      '这条消息看起来像随口提一下，但它是一个真正的任务：父亲降压药不能断。"收到"不等于承接 —— 建议弟弟正式确认时间和完成证明，让任务真的落下来。',
    riskNotes: [
      '弟弟回复"收到"后还没正式确认时间和证明',
      '不补齐这两项，药真断了就晚了',
    ],
  },
  {
    id: 't2',
    title: '爸爸周一高血压复诊',
    category: 'medical',
    sourceMessageIds: ['m7', 'm8'],
    sourceSummary: '医院提醒 + 妈妈早间血压数据 148/92',
    originatorId: 'tangning',
    locationName: '社区医院',
    startDateTime: '周一 09:20',
    suggestedOwnerId: 'bro',
    suggestionReason: '弟弟同城，可以陪诊。妈妈负责前一晚空腹提醒，唐宁仅做事后报销整理。',
    dueDateText: '周一 9:20',
    dueDate: '2026-05-25',
    status: 'needs_owner',
    urgency: 'high',
    subtasks: [
      { id: 's10', title: '前一晚 22:00 后空腹', phase: 'before', completed: false, suggestedOwnerId: 'mom' },
      { id: 's11', title: '早 7:40 出门', phase: 'before', completed: false },
      { id: 's12', title: '8:20 医院门口接老人', phase: 'before', completed: false, suggestedOwnerId: 'bro' },
      { id: 's13', title: '携带医保卡、蓝色文件袋、血压记录本', phase: 'before', completed: false, suggestedOwnerId: 'bro' },
      { id: 's14', title: '问医生：近一周血压、是否调药、下次复诊', phase: 'during', completed: false, suggestedOwnerId: 'bro' },
      { id: 's15', title: '处方与缴费单拍照发群', phase: 'after', completed: false, suggestedOwnerId: 'bro' },
      { id: 's16', title: '若调药，妈妈语音说明、弟弟拍药盒', phase: 'after', completed: false, suggestedOwnerId: 'mom' },
      { id: 's17', title: '报销整理（周三晚）', phase: 'after', completed: false, suggestedOwnerId: 'tangning' },
    ],
    requiredProof: ['处方照片', '缴费单照片', '调药后的药盒照片'],
    aiExplanation:
      '这是一条标准复诊任务，唐宁完全可以不出现在现场。系统已自动拆成"前一晚 / 当天 / 之后"三段，每段由不同的人承接，把唐宁从"全流程负责"降到"只做事后报销"。',
    riskNotes: [
      '没人确认弟弟是否周一请假',
      '检查单可能拿成上次的心电图（妈妈历史易混）',
      '若不当天对账，报销会拖到唐宁周末补',
    ],
  },
  {
    id: 't3',
    title: '燃气年检预约',
    category: 'household_admin',
    sourceMessageIds: ['m6'],
    sourceSummary: '物业通知：本周内预约燃气年检',
    originatorId: 'zhou',
    suggestedOwnerId: 'zhou',
    suggestionReason: '居家事务，周勉在上海家中可对接师傅。',
    dueDateText: '本周日前',
    dueDate: '2026-05-29',
    status: 'pending_acceptance',
    urgency: 'medium',
    subtasks: [
      { id: 's20', title: '查公众号预约时段', phase: 'before', completed: false },
      { id: 's21', title: '选周五下午或周末', phase: 'before', completed: false },
      { id: 's22', title: '当天在家接师傅', phase: 'during', completed: false },
      { id: 's23', title: '保存合格证照片', phase: 'after', completed: false },
    ],
    requiredProof: ['年检合格证照片'],
    aiExplanation:
      '家务任务里最容易"想到 → 忘了 → 罚款"的一类。我们把它从唐宁脑子里搬出来，明确指派周勉，并要求一张合格证照片作为完成证据。',
    riskNotes: ['不约就要等下一波 · 罚单更麻烦'],
  },
  {
    id: 't4',
    title: '孩子亲子手工作品',
    category: 'child_school',
    sourceMessageIds: ['m5'],
    sourceSummary: '幼儿园老师：明天带孩子作品到班级门口拍照',
    originatorId: 'zhou',
    suggestedOwnerId: 'zhou',
    suggestionReason: '周勉在家，第二天早上可以直接带到班级门口拍照。',
    dueDateText: '明天上学前',
    dueDate: '2026-05-25',
    status: 'pending_acceptance',
    urgency: 'medium',
    subtasks: [
      { id: 's30', title: '翻找去年剩下的卡纸', phase: 'before', completed: false, ownerId: 'zhou' },
      { id: 's31', title: '剪几片树叶形状', phase: 'before', completed: false, ownerId: 'zhou' },
      { id: 's32', title: '明天到班级门口拍照', phase: 'during', completed: false, ownerId: 'zhou' },
      { id: 's33', title: '把照片发到家庭群', phase: 'after', completed: false, ownerId: 'zhou' },
    ],
    requiredProof: ['班级门口照片'],
    aiExplanation:
      '半夜九点二十才发的群通知，容易被刷过去。建议提前准备好材料，明早周勉送到班级门口拍张照就好。',
    riskNotes: ['老师消息容易被群信息淹没 · 设个早上提醒'],
  },
  {
    id: 't5',
    title: '妈妈血压表电池',
    category: 'elderly_care',
    sourceMessageIds: [],
    sourceSummary: '唐宁注意到的家务事，还没在群里说',
    originatorId: 'tangning',
    suggestedOwnerId: 'bro',
    suggestionReason: '低紧急度。可在弟弟下次回父母家时顺手处理。',
    dueDateText: '本周内',
    dueDate: '2026-05-30',
    status: 'detected',
    urgency: 'low',
    subtasks: [
      { id: 's40', title: '确认电池型号', phase: 'before', completed: false },
      { id: 's41', title: '买好带回父母家', phase: 'during', completed: false },
    ],
    requiredProof: ['更换后的血压读数截图'],
    aiExplanation:
      '这是一个典型的"还没说出口的任务" —— 它只存在于唐宁的脑子里。系统的工作之一就是把这些后台任务挖出来，让它们有名字、有负责人。',
    riskNotes: ['一直只在唐宁脑中，从未说出口'],
  },
]

/* -------------------------------------------------------------------------- */
/* 责任风险示例                                                                */
/* -------------------------------------------------------------------------- */

export const SAMPLE_RISKS: ResponsibilityRisk[] = [
  {
    id: 'r1',
    taskId: 't1',
    personId: 'bro',
    type: 'vague_acknowledgement',
    severity: 'high',
    message: '弟弟仅回复"收到"，还没确认截止时间和完成证明',
    suggestedPrompt:
      '请弟弟确认：「明天中午前完成 + 上传药品照片到家庭群」？',
  },
  {
    id: 'r3',
    taskId: 't2',
    type: 'missing_deadline',
    severity: 'medium',
    message: '复诊流程已建好，但还没人确认周一陪诊',
    suggestedPrompt:
      '群里 @ 弟弟：「你周一 8:20 能到医院门口吗？」',
  },
  {
    id: 'r4',
    taskId: 't3',
    personId: 'zhou',
    type: 'missing_proof',
    severity: 'medium',
    message: '燃气年检派给周勉，但还没约定上传合格证',
    suggestedPrompt: '加一条：完成后上传合格证照片到家庭群。',
  },
]

/* -------------------------------------------------------------------------- */
/* 心智负担快照 · Before / After                                              */
/* -------------------------------------------------------------------------- */

export const MENTAL_LOAD_BEFORE: WeeklyMentalLoadSnapshot = buildSnapshot(
  FAMILY_MEMBERS,
  {
    tangning: { originated: 18, executed: 6, followUps: 22, verified: 9, fallbacks: 7 },
    zhou:     { originated: 2,  executed: 8, followUps: 1,  verified: 1, fallbacks: 0 },
    bro:      { originated: 1,  executed: 4, followUps: 0,  verified: 1, fallbacks: 0 },
    mom:      { originated: 3,  executed: 2, followUps: 0,  verified: 0, fallbacks: 0 },
    dad:      { originated: 0,  executed: 1, followUps: 0,  verified: 0, fallbacks: 0 },
    kid:      { originated: 0,  executed: 0, followUps: 0,  verified: 0, fallbacks: 0 },
  },
  '上线前 · 本周',
)

export const MENTAL_LOAD_AFTER: WeeklyMentalLoadSnapshot = buildSnapshot(
  FAMILY_MEMBERS,
  {
    tangning: { originated: 11, executed: 4, followUps: 8,  verified: 3, fallbacks: 1 },
    zhou:     { originated: 4,  executed: 9, followUps: 3,  verified: 4, fallbacks: 0 },
    bro:      { originated: 3,  executed: 7, followUps: 2,  verified: 3, fallbacks: 0 },
    mom:      { originated: 4,  executed: 3, followUps: 1,  verified: 1, fallbacks: 0 },
    dad:      { originated: 0,  executed: 1, followUps: 0,  verified: 0, fallbacks: 0 },
    kid:      { originated: 0,  executed: 0, followUps: 0,  verified: 0, fallbacks: 0 },
  },
  '使用后 · 第二周',
)
