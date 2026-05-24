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

const WARM_TRAIT_LABEL: Record<string, string> = {
  '同城父母': '和父母同城',
  '同城老人': '和长辈同城',
  '可跑腿': '方便帮忙跑一趟',
  '会陪诊': '愿意陪诊',
  '能买药': '方便买药',
  '会拍照': '会分享照片',
  '了解老人状况': '熟悉长辈近况',
  '同城孩子': '和孩子同城',
  '能拍照上传': '会分享照片',
  '家务行政': '会打理家中安排',
  '日历可靠': '会记住重要日子',
  '可对接师傅': '方便接待师傅',
  '同城家中': '方便到家里',
  '票据整理': '会整理票据',
  '统筹': '善于统筹',
}

function describeTraits(hits: string[]): string {
  return hits.slice(0, 2).map((t) => WARM_TRAIT_LABEL[t] ?? t).join('、')
}

const CATEGORY_HINTS: Record<TaskCategory, CategoryHint> = {
  elderly_care: {
    preferredTraits: ['和父母同城', '和长辈同城', '同城父母', '同城老人', '方便帮忙跑一趟', '可跑腿', '愿意陪诊', '会陪诊', '方便买药', '能买药', '熟悉家里近况', '了解老人状况', '会分享照片', '会拍照'],
    avoid: ['最近需要休息', '已超载', '适合轻松的小事', '只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `${m.name} ${describeTraits(hits)}，也许方便陪着把这件事办好。`
        : `${m.name} 可能比较方便回应这份牵挂，可以先问问 ta。`,
  },
  medical: {
    preferredTraits: ['和父母同城', '和长辈同城', '同城父母', '同城老人', '愿意陪诊', '会陪诊', '方便帮忙跑一趟', '可跑腿', '会分享照片', '会拍照', '熟悉家里近况', '了解老人状况'],
    avoid: ['最近需要休息', '已超载', '适合轻松的小事', '只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `${m.name} ${describeTraits(hits)}，或许适合陪着去看看。`
        : `${m.name} 或许方便陪伴这次就诊，可以先问问 ta。`,
  },
  child_school: {
    preferredTraits: ['和孩子同城', '同城孩子', '同城学校', '会分享照片', '能拍照上传', '会打理家中安排', '家务行政', '会记住重要日子', '日历可靠'],
    avoid: ['最近需要休息', '已超载', '适合轻松的小事', '只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `${m.name} ${describeTraits(hits)}，可能方便陪孩子完成。`
        : `${m.name} 可能方便陪孩子完成这件小事。`,
  },
  household_admin: {
    preferredTraits: ['会打理家中安排', '家务行政', '会记住重要日子', '日历可靠', '方便接待师傅', '可对接师傅', '方便到家里', '同城家中', '会分享照片', '能拍照上传'],
    avoid: ['最近需要休息', '已超载'],
    reason: (m, hits) =>
      hits.length > 0
        ? `${m.name} ${describeTraits(hits)}，可能方便在家接应。`
        : `${m.name} 也许方便照看这件家中小事，可以先问问 ta。`,
  },
  reimbursement: {
    preferredTraits: ['会整理票据', '票据整理', '善于统筹', '统筹'],
    avoid: ['适合轻松的小事', '只能做简单事'],
    reason: (m, hits) =>
      hits.length > 0
        ? `${m.name} ${describeTraits(hits)}，可能方便整理留存。`
        : `${m.name} 或许方便整理这些记录，可以先问问 ta。`,
  },
  general_family: {
    preferredTraits: ['会分享照片', '能拍照上传', '会记住重要日子', '日历可靠', '方便帮忙跑一趟', '可跑腿', '方便到家里', '同城家中'],
    reason: (m, hits) =>
      hits.length > 0
        ? `${m.name} ${describeTraits(hits)}，或许方便帮一把。`
        : `${m.name} 可能有余裕回应这件小事，可以先问问 ta。`,
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
