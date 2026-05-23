/**
 * 统一的「三色」状态系统 · green / yellow / red
 *
 * 整个 app 的所有任务卡 / 徽章 / 边框都用这个 map，避免色彩泛滥。
 */

import type { CareTask, SimpleStatusTone, TaskStatus } from './types'

export interface StatusVisual {
  tone: SimpleStatusTone
  /** 简单模式（家人通用）的标签 */
  simpleLabel: string
  /** 标准 / 协调者视角的标签 */
  proLabel: string
  /** 文字颜色 class */
  textCls: string
  /** 边框颜色 class（卡左侧细线） */
  borderCls: string
  /** 浅色背景 class（chip / 警告条） */
  softBgCls: string
}

const RED: Pick<StatusVisual, 'tone' | 'textCls' | 'borderCls' | 'softBgCls'> = {
  tone: 'red',
  textCls: 'text-rouge-500',
  borderCls: 'border-rouge-500',
  softBgCls: 'bg-rouge-50',
}

const YELLOW: Pick<StatusVisual, 'tone' | 'textCls' | 'borderCls' | 'softBgCls'> = {
  tone: 'yellow',
  // 用 ink-700 + 一抹 rouge-200 边，避免引入新色 —— 视觉上仍是"warm warning"
  textCls: 'text-ink-700',
  borderCls: 'border-rouge-200',
  softBgCls: 'bg-paper-100',
}

const GREEN: Pick<StatusVisual, 'tone' | 'textCls' | 'borderCls' | 'softBgCls'> = {
  tone: 'green',
  textCls: 'text-moss-500',
  borderCls: 'border-moss-500',
  softBgCls: 'bg-moss-50',
}

const NEUTRAL: Pick<StatusVisual, 'tone' | 'textCls' | 'borderCls' | 'softBgCls'> = {
  tone: 'neutral',
  textCls: 'text-ink-400',
  borderCls: 'border-ink-200',
  softBgCls: 'bg-paper-50',
}

/**
 * 标准化的 5 个状态标签 · 简单 = 专业模式相同 ·
 * 控制每张卡右上角只看到这 5 个词之一：
 *   待分配 / 待确认 / 已承接 / 待证明 / 已完成
 *
 * 多余的"是不是回到同一个人"、"是不是只回了收到"等信号，
 * 转移到卡片里的二级文字（"现在落在 XXX" / "只回了收到" 提示）。
 */
const STATUS_VISUAL: Record<TaskStatus, StatusVisual> = {
  // 待分配 · 发起人需要安排 · 三种内部状态统一显示
  detected:           { ...RED,     simpleLabel: '待分配', proLabel: '待分配' },
  needs_owner:        { ...RED,     simpleLabel: '待分配', proLabel: '待分配' },
  fallback_risk:      { ...RED,     simpleLabel: '待分配', proLabel: '待分配' },
  // 待确认 · 已经派给某人，等他/她点"我接手"
  pending_acceptance: { ...YELLOW,  simpleLabel: '待确认', proLabel: '待确认' },
  // 已承接 / 已完成
  accepted:           { ...GREEN,   simpleLabel: '已承接', proLabel: '已承接' },
  in_progress:        { ...GREEN,   simpleLabel: '已承接', proLabel: '已承接' },
  needs_proof:        { ...YELLOW,  simpleLabel: '待证明', proLabel: '待证明' },
  completed:          { ...NEUTRAL, simpleLabel: '已完成', proLabel: '已完成' },
}

export function statusVisualFor(s: TaskStatus): StatusVisual {
  return STATUS_VISUAL[s] ?? STATUS_VISUAL.detected
}

export function isDraftStatus(s: TaskStatus): boolean {
  return s === 'detected' || s === 'needs_owner' || s === 'fallback_risk'
}

export function isTaskDraft(task: CareTask): boolean {
  return isDraftStatus(task.status)
}

export function taskActualAssigneeIds(task: CareTask): string[] {
  const ids = new Set<string>()
  if (task.executorId) ids.add(task.executorId)
  task.subtasks.forEach((sub) => {
    if (sub.ownerId) ids.add(sub.ownerId)
  })
  return Array.from(ids)
}

/**
 * Who has actually been asked to confirm this task.
 *
 * Most tasks store assignment in executorId/subtask.ownerId. Some seed/demo
 * tasks model a sent-but-unaccepted card with only suggestedOwnerId, so for
 * pending_acceptance we treat suggestions as the pending assignee fallback.
 */
export function taskAssigneeIds(task: CareTask): string[] {
  const actual = taskActualAssigneeIds(task)
  if (actual.length > 0) return actual
  if (task.status !== 'pending_acceptance') return []

  const ids = new Set<string>()
  if (task.suggestedOwnerId) ids.add(task.suggestedOwnerId)
  task.subtasks.forEach((sub) => {
    if (sub.suggestedOwnerId) ids.add(sub.suggestedOwnerId)
  })
  return Array.from(ids)
}

export function isTaskAssignedToUser(task: CareTask, userId: string): boolean {
  return taskAssigneeIds(task).includes(userId)
}

export function isTaskAcceptedByUser(task: CareTask, userId: string): boolean {
  const assignees = taskAssigneeIds(task)
  if (!assignees.includes(userId)) return false
  if (task.acceptedBy?.includes(userId)) return true
  return (
    taskActualAssigneeIds(task).includes(userId) &&
    (task.status === 'accepted' ||
      task.status === 'in_progress' ||
      task.status === 'needs_proof')
  )
}

export function isTaskAwaitingUserConfirmation(task: CareTask, userId: string): boolean {
  if (task.status === 'completed' || isTaskDraft(task)) return false
  if (!isTaskAssignedToUser(task, userId)) return false
  if (isTaskAcceptedByUser(task, userId)) return false
  return task.status === 'pending_acceptance'
}

export function statusVisualForTask(task: CareTask, userId?: string): StatusVisual {
  if (!userId) return statusVisualFor(task.status)
  if (isTaskAcceptedByUser(task, userId)) return STATUS_VISUAL.accepted
  if (isTaskAwaitingUserConfirmation(task, userId)) return STATUS_VISUAL.pending_acceptance
  return statusVisualFor(task.status)
}

export function statusLabel(s: TaskStatus, mode: 'simple' | 'pro' = 'pro'): string {
  const v = statusVisualFor(s)
  return mode === 'simple' ? v.simpleLabel : v.proLabel
}
