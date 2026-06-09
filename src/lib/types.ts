/**
 * 后台审计 · 核心类型定义
 * Backstage Audit · core type definitions
 */

export type FamilyMemberRole =
  | 'originator'   // 想到并发起任务的人
  | 'executor'     // 执行任务的人
  | 'verifier'     // 上传证明 / 确认完成的人
  | 'observer'    // 旁观者

export type TaskCategory =
  | 'elderly_care'      // 老人照护
  | 'medical'           // 医疗复诊
  | 'child_school'      // 孩子学校
  | 'household_admin'   // 物业 / 家务行政
  | 'reimbursement'     // 报销 / 票据
  | 'general_family'    // 一般家事

export type TaskStatus =
  | 'detected'            // AI 刚识别出，未指派
  | 'needs_owner'         // 缺执行人
  | 'pending_acceptance' // 已指派，但只回复了"收到"
  | 'accepted'            // 明确承接（含截止时间和证明）
  | 'in_progress'         // 执行中
  | 'needs_proof'         // 等待上传证明
  | 'completed'           // 全部完成
  | 'fallback_risk'      // 有掉回发起人风险

export type Urgency = 'low' | 'medium' | 'high'

export type CapacityTag = 'busy' | 'medium' | 'flexible'

/**
 * Trait chips · 影响 AI 指派
 * 不要硬编码 enum — 用户可以自由编辑/新增
 */
export type FamilyTrait = string

export type UIMode = 'standard' | 'elder'

export interface FamilyMember {
  id: string
  name: string
  relation: string        // 我 / 弟弟 / 妈妈 / 周勉
  avatarColor: string     // tailwind color class
  city?: string
  /** 工作日很忙 / 中等 / 在家时间多 */
  capacity?: CapacityTag
  availability?: string
  notes?: string
  /** 性格 / 擅长 / 限制 —— 影响 AI 指派 */
  traits?: FamilyTrait[]
  /** 界面模式建议（默认根据 capacity / role 自动推断） */
  uiMode?: UIMode
}

export interface RawMessage {
  id: string
  speakerId: string       // member id, or 'system' for school/hospital
  speakerLabel: string    // 显示用名字，例如 '幼儿园老师'
  channel: '家庭群' | '医院提醒' | '幼儿园群' | '物业通知' | '日历' | '私聊' | '便签'
  timestamp: string       // human-readable, e.g. '昨天 17:08'
  body: string
}

/** 简化的三色系统 · 给所有卡片用 */
export type SimpleStatusTone = 'green' | 'yellow' | 'red' | 'neutral'

export interface TaskAttachment {
  id: string
  type: 'image'
  url: string             // 一般是 createObjectURL 生成的本地 url
  fileName?: string
  caption?: string
  uploadedById?: string
  createdAt: string
}

export interface SubTask {
  id: string
  title: string
  phase: 'before' | 'during' | 'after' | 'general'
  /** 当前执行人（用户可以从 UI 修改） */
  ownerId?: string
  /** AI / 模板的初始推荐（只读，给「按推荐指派」一键派单用） */
  suggestedOwnerId?: string
  completed: boolean
  /** 可选：拍照证明 */
  attachments?: TaskAttachment[]
}

export interface CareTask {
  id: string
  title: string
  category: TaskCategory
  sourceMessageIds: string[]     // 关联的原始消息
  sourceSummary: string          // 一句话回顾消息
  originatorId: string           // 一般是"妈妈"或"系统"
  /** 来源更具体的标签，例如 "医院提醒" / "幼儿园群" / "物业通知" / "我想到的事" */
  originatorLabel?: string
  executorId?: string            // 当前执行人
  verifierId?: string            // 证明上传人
  suggestedOwnerId?: string      // AI 推荐执行人
  suggestionReason?: string      // AI 为何推荐 ta
  dueDateText?: string
  /** 截止日期 · ISO YYYY-MM-DD · 用于排序和"x月x日 周X"格式化 */
  dueDate?: string
  /** 可选：精确到日期/时间，给日历导出用 */
  startDateTime?: string
  endDateTime?: string
  /** 可选：地点 */
  locationName?: string
  locationAddress?: string
  status: TaskStatus
  urgency: Urgency
  subtasks: SubTask[]
  requiredProof?: string[]       // ['处方照片', '缴费单', '药品照片']
  aiExplanation?: string
  riskNotes?: string[]
  attachments?: TaskAttachment[]
  /**
   * 哪些家人已经明确承接了"自己那一部分"
   * 多人任务（不同子任务分给不同人）专用：只有所有 ownerId 都进了这个列表，
   * 整个任务才算 'accepted'，否则保持 'pending_acceptance'。
   */
  acceptedBy?: string[]
}

export type RiskType =
  | 'vague_acknowledgement'       // "收到" 没下文
  | 'missing_deadline'
  | 'missing_proof'
  | 'fallback_to_originator'      // 任务会回到发起人
  | 'overloaded_originator'       // 发起人已超载

export interface ResponsibilityRisk {
  id: string
  taskId: string
  personId?: string
  type: RiskType
  severity: Urgency
  message: string                 // 简短描述
  suggestedPrompt: string         // 系统建议如何追问
  resolved?: boolean
}

export interface MentalLoadEntry {
  memberId: string
  originated: number
  executed: number
  followUps: number
  verified: number
  fallbacks: number
  score: number
  percentage: number              // 0~1
}

export interface WeeklyMentalLoadSnapshot {
  label: string                   // 'before' | 'after'
  entries: MentalLoadEntry[]
}

/* -------------------------------------------------------------------------- */
/* 多人协作 · 承接 / 拒绝 / 通知                                              */
/* -------------------------------------------------------------------------- */

export type ResponseAction = 'accepted' | 'rejected' | 'snoozed'

export interface TaskResponse {
  id: string
  taskId: string
  responderId: string             // 谁做的回应
  action: ResponseAction
  reason?: string                 // 拒绝原因 / 备注
  at: number                      // timestamp
}

export type NotificationKind =
  | 'assignment'   // 你被指派了一个任务
  | 'accepted'     // 有人承接了你发出的任务
  | 'rejected'     // 有人拒绝了你发出的任务
  | 'snoozed'      // 有人推迟回复
  | 'completed'    // 任务被标记完成
  | 'nudge'        // 发起人追问

export interface AppNotification {
  id: string
  recipientId: string             // 谁能看到这条通知
  kind: NotificationKind
  message: string
  taskId?: string
  read: boolean
  at: number
}

/* -------------------------------------------------------------------------- */
/* 家庭记忆 · Family Memory Chat                                              */
/* -------------------------------------------------------------------------- */

export type FamilyMemoryIntent =
  | 'new_task'
  | 'risk_signal'
  | 'availability_update'
  | 'care_note'
  | 'question'
  | 'redistribution_request'

export type SuggestedActionType =
  | 'create_task'
  | 'update_task'
  | 'assign_owner'
  | 'add_reminder'
  | 'request_proof'
  | 'notify_family'
  | 'ignore'

export interface SuggestedAction {
  id: string
  label: string
  actionType: SuggestedActionType
  /** 任意 payload —— UI 不解释，由执行函数读取 */
  payload?: Record<string, unknown>
}

export type FamilyMemoryResolution =
  | 'task_created'   // 用户点了「创建任务」
  | 'noted'          // 用户点了「只记录」
  | 'ignored'        // 用户点了「忽略」

export interface FamilyMemoryEntry {
  id: string
  speakerId: string
  rawMessage: string
  createdAt: number                 // timestamp
  intent: FamilyMemoryIntent
  aiSummary: string                 // 一句简易回复给说话人
  extractedTitle?: string           // 如果识别到任务，标题
  suggestedOwnerId?: string
  suggestedSubtasks?: string[]
  suggestedDeadline?: string
  relatedTaskIds?: string[]
  suggestedActions: SuggestedAction[]
  /** 用户对这条记忆的最终处理 · 用于在 UI 上显示"已完成 / 已忽略"等状态 */
  resolution?: FamilyMemoryResolution
  resolvedAt?: number
  /** 如果 resolution === 'task_created'，对应的任务 id */
  resolvedTaskId?: string
  /** 同时通知了哪个家人（成员 id） */
  notifiedOwnerId?: string
}

/* -------------------------------------------------------------------------- */
/* 家庭聊天与可检索记忆 · Conversation + household knowledge                  */
/* -------------------------------------------------------------------------- */

export type FamilyChatAudience = 'family' | 'assistant'
export type FamilyChatReactionKind = 'heart' | 'seen'

export interface FamilyChatReaction {
  memberId: string
  kind: FamilyChatReactionKind
}

export interface FamilyChatMessage {
  id: string
  role: 'family' | 'assistant'
  speakerId?: string
  audience: FamilyChatAudience
  body: string
  createdAt: number
  /** 给助手的提问与回答是个人可见，不混入全家聊天。 */
  visibility?: 'family' | 'private'
  /** 回答实际引用到的家庭记忆，便于界面说明来源。 */
  memoryIds?: string[]
  /** 助手回答来自真实 AI，或来自无法联网时的本地记忆查找。 */
  answerMode?: 'ai' | 'memory' | 'task'
  /** 在「问欧哈娜」中从本次安排自动整理出的事项。 */
  taskIds?: string[]
  replyToId?: string
  reactions?: FamilyChatReaction[]
}

export type HouseholdMemoryCategory =
  | 'location'
  | 'appointment'
  | 'health'
  | 'routine'
  | 'contact'
  | 'other'

export type HouseholdMemoryVisibility = 'family' | 'selected' | 'private'

export interface HouseholdMemoryPhoto {
  id: string
  dataUrl: string
  fileName: string
  caption?: string
  uploadedById?: string
  createdAt: number
}

export interface HouseholdMemory {
  id: string
  title: string
  detail: string
  category: HouseholdMemoryCategory
  keywords: string[]
  createdAt: number
  createdById?: string
  sourceMessageId?: string
  visibility?: HouseholdMemoryVisibility
  sharedWithIds?: string[]
  pinned?: boolean
  updatedAt?: number
  confirmedAt?: number
  /** 位置现场图，例如医药卡所在的抽屉或文件袋。 */
  photos?: HouseholdMemoryPhoto[]
}
