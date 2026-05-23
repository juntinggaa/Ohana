/**
 * Agent · 指派推荐
 *
 * 给一条任务（category + 标题）+ 当前家庭成员（含 traits / city / capacity），
 * 返回：
 *   - 推荐执行人
 *   - 一句简体中文的解释（让 AI 决策可被读懂）
 *
 * 完全确定性逻辑 —— 不依赖 LLM，可被前端/store 直接调用。
 */

import type { CareTask, FamilyMember, TaskCategory } from '../types'

interface CategoryHint {
  /** 优先匹配的 traits（按从前到后的偏好排序） */
  preferredTraits: string[]
  /** 不应该被默认派给（除非别人都不合适） */
  avoid?: string[]
  /** category-level 中文解释模板 */
  reason: (member: FamilyMember, traits: string[]) => string
}

const CATEGORY_HINTS: Record<TaskCategory, CategoryHint> = {
  elderly_care: {
    preferredTraits: ['同城父母', '同城老人', '可跑腿', '会陪诊', '能买药', '了解老人状况', '会拍照'],
    avoid: ['已超载', '只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `推荐 ${m.name}：${hits.slice(0, 2).join(' / ')}，处理老人药品 / 跑腿成本最低。`
        : `推荐 ${m.name}：综合考虑了关系、距离和当前空闲程度。`,
  },
  medical: {
    preferredTraits: ['同城父母', '同城老人', '会陪诊', '可跑腿', '会拍照', '了解老人状况'],
    avoid: ['已超载', '只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `推荐 ${m.name}：${hits.slice(0, 2).join(' / ')}，适合现场陪诊和拍处方。`
        : `推荐 ${m.name}：更可能方便现场跟进，并且当前空闲程度更高。`,
  },
  child_school: {
    preferredTraits: ['同城孩子', '同城学校', '能拍照上传', '家务行政', '日历可靠'],
    avoid: ['已超载', '只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `推荐 ${m.name}：${hits.slice(0, 2).join(' / ')}，可以直接到班级门口拍照。`
        : `推荐 ${m.name}：更可能和孩子/学校同城，日历也相对可控。`,
  },
  household_admin: {
    preferredTraits: ['家务行政', '日历可靠', '可对接师傅', '同城家中', '能拍照上传'],
    avoid: ['已超载'],
    reason: (m, hits) =>
      hits.length > 0
        ? `推荐 ${m.name}：${hits.slice(0, 2).join(' / ')}，物业 / 师傅这类事务他/她最稳。`
        : `推荐 ${m.name}：家中行政事务由他/她处理最稳，也避免又回到同一个人。`,
  },
  reimbursement: {
    preferredTraits: ['票据整理', '统筹'],
    avoid: ['只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `推荐 ${m.name}：${hits.slice(0, 2).join(' / ')}，集中在一个晚上处理最高效。`
        : `推荐 ${m.name}：报销整理需要一个时间整块处理的人。`,
  },
  general_family: {
    preferredTraits: ['能拍照上传', '日历可靠', '可跑腿', '同城家中'],
    reason: (m, hits) =>
      hits.length > 0
        ? `推荐 ${m.name}：${hits.slice(0, 2).join(' / ')}。`
        : `推荐 ${m.name}：当前空闲程度较高。`,
  },
}

function includesAny(text: string | undefined, words: string[]): boolean {
  if (!text) return false
  return words.some((w) => text.includes(w))
}

function relationOf(member: FamilyMember): string {
  return `${member.name} ${member.relation} ${member.notes ?? ''}`
}

function isSelf(member: FamilyMember): boolean {
  return includesAny(relationOf(member), ['我自己', '我', '本人'])
}

function isPartner(member: FamilyMember): boolean {
  return includesAny(relationOf(member), ['伴侣', '丈夫', '妻子', '老公', '老婆'])
}

function isSibling(member: FamilyMember): boolean {
  return includesAny(relationOf(member), ['弟弟', '妹妹', '哥哥', '姐姐'])
}

function isParent(member: FamilyMember): boolean {
  return includesAny(relationOf(member), ['妈妈', '爸爸', '母亲', '父亲'])
}

function isChild(member: FamilyMember): boolean {
  return includesAny(relationOf(member), ['孩子', '儿子', '女儿', '小孩'])
}

function sameCity(a: FamilyMember | undefined, b: FamilyMember | undefined): boolean {
  if (!a?.city || !b?.city) return false
  return a.city.trim() === b.city.trim()
}

function taskSubject(title: string, members: FamilyMember[]): FamilyMember | undefined {
  return members.find((m) => {
    const relation = m.relation.replace('我自己', '').trim()
    return (
      (m.name && title.includes(m.name)) ||
      (relation.length > 0 && title.includes(relation))
    )
  })
}

function relationScore(
  member: FamilyMember,
  task: Pick<CareTask, 'category' | 'title'>,
  members: FamilyMember[],
): number {
  const subject = taskSubject(task.title, members)
  let total = 0

  if (subject && member.id !== subject.id && sameCity(member, subject)) total += 8

  if (task.category === 'elderly_care' || task.category === 'medical') {
    if (isSibling(member)) total += 5
    if (isPartner(member)) total += 3
    if (isSelf(member)) total += 2
    if (isParent(member)) total += 1
    if (subject?.id === member.id) total -= 10
  }

  if (task.category === 'child_school') {
    if (isSelf(member) || isPartner(member)) total += 5
    if (isSibling(member)) total += 1
    if (subject?.id === member.id) total -= 30
  }

  if (task.category === 'household_admin') {
    if (isSelf(member) || isPartner(member)) total += 4
    const self = members.find(isSelf)
    if (self && member.id !== self.id && sameCity(member, self)) total += 2
  }

  if (task.category === 'reimbursement') {
    if (isSelf(member)) total += 3
    if (isPartner(member) || isSibling(member)) total += 1
  }

  if (task.category === 'general_family') {
    if (isSelf(member) || isPartner(member) || isSibling(member)) total += 2
  }

  if (isChild(member)) total -= 30
  return total
}

function score(
  member: FamilyMember,
  hint: CategoryHint,
  task: Pick<CareTask, 'category' | 'title'>,
  members: FamilyMember[],
): {
  total: number
  hits: string[]
} {
  const traits = member.traits ?? []
  const hits = hint.preferredTraits.filter((t) => traits.includes(t))
  let total = hits.length * 10 + relationScore(member, task, members)

  // capacity 修正
  if (member.capacity === 'flexible') total += 2
  if (member.capacity === 'medium') total += 1
  if (member.capacity === 'busy') total -= 2

  // avoid 严重扣分
  if (hint.avoid?.some((t) => traits.includes(t))) total -= 12

  // 小孩不能承接复杂任务
  if (isChild(member)) total -= 30

  return { total, hits }
}

export interface AssignmentRecommendation {
  ownerId: string
  reason: string
  matchedTraits: string[]
}

export function recommendOwner(
  task: Pick<CareTask, 'category' | 'title'>,
  members: FamilyMember[],
): AssignmentRecommendation | null {
  const hint = CATEGORY_HINTS[task.category]
  if (!hint) return null
  if (members.length === 0) return null

  const scored = members
    .filter((m) => !isChild(m) || hint.preferredTraits.includes('只能做简单事'))
    .map((m) => ({ m, ...score(m, hint, task, members) }))
    .sort((a, b) => b.total - a.total)

  const best = scored[0]
  if (!best) return null

  return {
    ownerId: best.m.id,
    reason: hint.reason(best.m, best.hits),
    matchedTraits: best.hits,
  }
}

/**
 * 为一组子任务依次推荐执行人 —— 用最简单的规则：
 *   - before / 准备类 → 偏好 "在家时间多" / "可跑腿"
 *   - during / 现场 → 偏好 "同城父母" / "会陪诊"
 *   - after / 跟进 → 偏好 "能拍照上传" / "票据整理"
 *   - general → 跟随主任务
 */
export function recommendForCategoryFallback(
  category: TaskCategory,
  members: FamilyMember[],
): string | undefined {
  return recommendOwner({ category, title: '' }, members)?.ownerId
}
