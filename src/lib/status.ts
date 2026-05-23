/**
 * 统一的「三色」状态系统 · green / yellow / red
 *
 * 整个 app 的所有任务卡 / 徽章 / 边框都用这个 map，避免色彩泛滥。
 */

import type { SimpleStatusTone, TaskStatus } from './types'

export interface StatusVisual {
  tone: SimpleStatusTone
  /** 简单模式（家人通用）的标签 */
  simpleLabel: string
  /** 专业模式（唐宁视角）的标签 */
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
  detected:           { ...YELLOW,  simpleLabel: '待确认', proLabel: '待确认' },
  needs_owner:        { ...RED,     simpleLabel: '待分配', proLabel: '待分配' },
  pending_acceptance: { ...YELLOW,  simpleLabel: '待确认', proLabel: '待确认' },
  accepted:           { ...GREEN,   simpleLabel: '已承接', proLabel: '已承接' },
  in_progress:        { ...GREEN,   simpleLabel: '已承接', proLabel: '已承接' },
  needs_proof:        { ...YELLOW,  simpleLabel: '待证明', proLabel: '待证明' },
  completed:          { ...NEUTRAL, simpleLabel: '已完成', proLabel: '已完成' },
  fallback_risk:      { ...RED,     simpleLabel: '待分配', proLabel: '待分配' },
}

export function statusVisualFor(s: TaskStatus): StatusVisual {
  return STATUS_VISUAL[s] ?? STATUS_VISUAL.detected
}

export function statusLabel(s: TaskStatus, mode: 'simple' | 'pro' = 'pro'): string {
  const v = statusVisualFor(s)
  return mode === 'simple' ? v.simpleLabel : v.proLabel
}
