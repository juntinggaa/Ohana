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

export interface FamilyMember {
  id: string
  name: string
  relation: string        // 我 / 弟弟 / 妈妈 / 周勉
  avatarColor: string     // tailwind color class
  city?: string
  availability?: string
  notes?: string
}

export interface RawMessage {
  id: string
  speakerId: string       // member id, or 'system' for school/hospital
  speakerLabel: string    // 显示用名字，例如 '幼儿园老师'
  channel: '家庭群' | '医院提醒' | '幼儿园群' | '物业通知' | '日历' | '私聊' | '便签'
  timestamp: string       // human-readable, e.g. '昨天 17:08'
  body: string
}

export interface SubTask {
  id: string
  title: string
  phase: 'before' | 'during' | 'after' | 'general'
  ownerId?: string
  completed: boolean
}

export interface CareTask {
  id: string
  title: string
  category: TaskCategory
  sourceMessageIds: string[]     // 关联的原始消息
  sourceSummary: string          // 一句话回顾消息
  originatorId: string           // 一般是"妈妈"或"系统"
  executorId?: string            // 当前执行人
  verifierId?: string            // 证明上传人
  suggestedOwnerId?: string      // AI 推荐执行人
  suggestionReason?: string      // AI 为何推荐 ta
  dueDateText?: string
  status: TaskStatus
  urgency: Urgency
  subtasks: SubTask[]
  requiredProof?: string[]       // ['处方照片', '缴费单', '药品照片']
  aiExplanation?: string
  riskNotes?: string[]
}

export type RiskType =
  | 'vague_acknowledgement'       // "收到" 没下文
  | 'missing_deadline'
  | 'missing_proof'
  | 'fallback_to_originator'      // 任务会回到唐宁
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
