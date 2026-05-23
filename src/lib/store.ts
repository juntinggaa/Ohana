/**
 * 应用全局状态 · Zustand + localStorage 持久化
 *
 * 设计原则：
 *   - 唯一数据源（single source of truth）
 *   - 所有页面读写都通过这里，刷新不丢
 *   - 提供清晰的 action 而不是直接暴露 set
 *   - 多人协作通过 currentUserId 切换"现在以谁的身份查看"
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AppNotification,
  CareTask,
  FamilyMember,
  FamilyMemoryEntry,
  MentalLoadEntry,
  NotificationKind,
  ResponsibilityRisk,
  ResponseAction,
  SubTask,
  TaskAttachment,
  TaskResponse,
} from './types'
import {
  FAMILY_MEMBERS,
  SAMPLE_TASKS,
  SAMPLE_RISKS,
  MENTAL_LOAD_BEFORE,
  MENTAL_LOAD_AFTER,
} from './mockData'
import { generateWorkflow } from './agents/careWorkflowAgent'
import { recommendForCategoryFallback } from './agents/assignmentAgent'
import type { CapturedTask } from './agents/taskCaptureAgent'

export type ToastTone = 'info' | 'success' | 'warn'
export interface Toast {
  id: string
  message: string
  tone: ToastTone
  ttl?: number
}

interface AcceptedRecord {
  taskId: string
  ownerId: string
  deadline: string
  acceptedAt: number
}

interface AppState {
  // ─── Identity ─────────────────────────────────────────
  currentUserId: string
  hasSeenWelcome: boolean

  // ─── Mode ─────────────────────────────────────────────
  /** 'auto' = 根据当前身份自动；'standard' = 标准（家人通用）；'elder' = 老人版 */
  uiModeOverride: 'auto' | 'standard' | 'elder'

  // ─── Family ───────────────────────────────────────────
  familyMembers: FamilyMember[]

  // ─── Tasks & analysis ────────────────────────────────
  tasks: CareTask[]
  risks: ResponsibilityRisk[]
  mentalLoadBefore: MentalLoadEntry[]
  mentalLoadAfter: MentalLoadEntry[]
  accepted: Record<string, AcceptedRecord>

  // ─── Multi-user collaboration ────────────────────────
  responses: TaskResponse[]
  notifications: AppNotification[]

  // ─── Family Memory Chat ──────────────────────────────
  familyMemoryEntries: FamilyMemoryEntry[]

  // ─── Ephemeral UI ────────────────────────────────────
  toasts: Toast[]

  // ─── Identity actions ────────────────────────────────
  setCurrentUser: (id: string) => void
  dismissWelcome: () => void
  setUiModeOverride: (m: AppState['uiModeOverride']) => void

  // ─── Family CRUD ─────────────────────────────────────
  addFamilyMember: (m: Omit<FamilyMember, 'id'> & { id?: string }) => string
  updateFamilyMember: (id: string, patch: Partial<FamilyMember>) => void
  removeFamilyMember: (id: string) => void
  setFamily: (members: FamilyMember[]) => void
  /** 给某成员加一个 trait（去重） */
  addTrait: (memberId: string, trait: string) => void
  /** 去掉一个 trait */
  removeTrait: (memberId: string, trait: string) => void

  // ─── Task actions ────────────────────────────────────
  ingestCapturedTasks: (captured: CapturedTask[]) => CareTask[]
  acceptResponsibility: (taskId: string, ownerId: string, deadline: string) => void
  unacceptResponsibility: (taskId: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  setSubtaskOwner: (taskId: string, subtaskId: string, ownerId: string | undefined) => void
  /** Sets every sub-task's ownerId = suggestedOwnerId; returns the new ownership map */
  assignAllRecommended: (taskId: string) => Record<string, string>
  markTaskCompleted: (taskId: string) => void
  removeTask: (taskId: string) => void
  addAttachment: (taskId: string, subtaskId: string | null, att: Omit<TaskAttachment, 'id' | 'createdAt'>) => void

  // ─── Family Memory Chat ──────────────────────────────
  pushFamilyMemoryEntry: (entry: FamilyMemoryEntry) => void
  resolveFamilyMemoryEntry: (
    entryId: string,
    resolution: FamilyMemoryEntry['resolution'],
    extras?: { taskId?: string; notifiedOwnerId?: string },
  ) => void
  clearFamilyMemoryEntries: () => void

  // ─── Multi-user actions ──────────────────────────────
  respondToTask: (taskId: string, action: ResponseAction, reason?: string) => void
  pushNotification: (notif: Omit<AppNotification, 'id' | 'at' | 'read'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (recipientId?: string) => void

  // ─── System / demo ──────────────────────────────────
  resetToSampleData: () => void
  clearAll: () => void

  // ─── Toast helpers ──────────────────────────────────
  pushToast: (message: string, tone?: ToastTone) => void
  removeToast: (id: string) => void
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeSubtasks(subtasks: SubTask[] | undefined): SubTask[] {
  if (!Array.isArray(subtasks)) return []
  // 给老数据 / 用户自建数据补 suggestedOwnerId（如果只有 ownerId）
  return subtasks.map((s) =>
    s.suggestedOwnerId === undefined && s.ownerId
      ? { ...s, suggestedOwnerId: s.ownerId }
      : s,
  )
}

function normalizeTasks(tasks: CareTask[] | undefined): CareTask[] {
  if (!Array.isArray(tasks)) return []
  return tasks.map((t) => ({ ...t, subtasks: normalizeSubtasks(t.subtasks) }))
}

function withRedistribution(
  before: MentalLoadEntry[],
  acceptedCount: number,
): MentalLoadEntry[] {
  const factor = Math.min(acceptedCount * 0.06, 0.55)
  const adjusted = before.map((e) => ({ ...e }))
  const tn = adjusted.find((e) => e.memberId === 'tangning')
  if (!tn) return adjusted
  const moved = tn.score * factor
  tn.score = Math.max(0, tn.score - moved)
  ;(['bro', 'zhou'] as const).forEach((id) => {
    const e = adjusted.find((x) => x.memberId === id)
    if (e) e.score += moved / 2
  })
  const total = adjusted.reduce((s, e) => s + e.score, 0) || 1
  adjusted.forEach((e) => (e.percentage = e.score / total))
  return adjusted
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // identity
      currentUserId: 'tangning',
      hasSeenWelcome: false,
      uiModeOverride: 'auto',

      // family
      familyMembers: FAMILY_MEMBERS,

      // tasks / analysis
      tasks: normalizeTasks(SAMPLE_TASKS),
      risks: SAMPLE_RISKS,
      mentalLoadBefore: MENTAL_LOAD_BEFORE.entries,
      mentalLoadAfter: MENTAL_LOAD_AFTER.entries,
      accepted: {},

      // multi-user
      responses: [],
      notifications: [],

      // family memory
      familyMemoryEntries: [],

      // ephemeral
      toasts: [],

      // ───── identity ──────────────────────────────────
      setCurrentUser: (id) => set({ currentUserId: id }),
      dismissWelcome: () => set({ hasSeenWelcome: true }),
      setUiModeOverride: (m) => set({ uiModeOverride: m }),

      // ───── family CRUD ───────────────────────────────
      addFamilyMember: (m) => {
        const id = m.id ?? newId('mem')
        const member: FamilyMember = {
          id,
          name: m.name,
          relation: m.relation,
          avatarColor: m.avatarColor ?? 'bg-ink-500 text-paper',
          city: m.city,
          capacity: m.capacity,
          availability: m.availability,
          notes: m.notes,
          traits: m.traits ?? [],
          uiMode: m.uiMode,
        }
        set((s) => ({ familyMembers: [...s.familyMembers, member] }))
        return id
      },

      updateFamilyMember: (id, patch) =>
        set((s) => ({
          familyMembers: s.familyMembers.map((m) =>
            m.id === id ? { ...m, ...patch } : m,
          ),
        })),

      removeFamilyMember: (id) =>
        set((s) => ({ familyMembers: s.familyMembers.filter((m) => m.id !== id) })),

      setFamily: (members) => set({ familyMembers: members }),

      addTrait: (memberId, trait) => {
        const clean = trait.trim()
        if (!clean) return
        set((s) => ({
          familyMembers: s.familyMembers.map((m) => {
            if (m.id !== memberId) return m
            const existing = m.traits ?? []
            if (existing.includes(clean)) return m
            return { ...m, traits: [...existing, clean] }
          }),
        }))
      },

      removeTrait: (memberId, trait) =>
        set((s) => ({
          familyMembers: s.familyMembers.map((m) =>
            m.id !== memberId
              ? m
              : { ...m, traits: (m.traits ?? []).filter((t) => t !== trait) },
          ),
        })),

      // ───── tasks ─────────────────────────────────────
      ingestCapturedTasks: (captured) => {
        const existingTitles = new Set(get().tasks.map((t) => t.title))
        const added: CareTask[] = []
        captured.forEach((c) => {
          if (existingTitles.has(c.title)) return
          const wf = generateWorkflow({ id: c.id, title: c.title, category: c.category })
          const task: CareTask = {
            id: c.id,
            title: c.title,
            category: c.category,
            sourceMessageIds: [],
            sourceSummary: c.matchedLine || '来自粘贴的家庭消息',
            originatorId: c.originatorId,
            suggestedOwnerId: c.suggestedOwnerId,
            suggestionReason: c.suggestionReason,
            dueDateText: c.dueDateText,
            status: 'needs_owner',
            urgency: c.urgency,
            subtasks: wf.subtasks,
            requiredProof: c.requiredProof ?? wf.requiredProof,
            aiExplanation: c.aiExplanation,
          }
          added.push(task)
        })
        if (added.length > 0) {
          set((s) => ({ tasks: [...added, ...s.tasks] }))
        }
        return added
      },

      acceptResponsibility: (taskId, ownerId, deadline) => {
        set((s) => {
          const accepted = {
            ...s.accepted,
            [taskId]: { taskId, ownerId, deadline, acceptedAt: Date.now() },
          }
          const tasks = s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: 'accepted' as const, executorId: ownerId, dueDateText: deadline }
              : t,
          )
          const mentalLoadAfter = withRedistribution(
            s.mentalLoadBefore,
            Object.keys(accepted).length,
          )
          return { accepted, tasks, mentalLoadAfter }
        })
        // 通知被指派的人
        const task = get().tasks.find((t) => t.id === taskId)
        if (task && ownerId !== get().currentUserId) {
          get().pushNotification({
            recipientId: ownerId,
            kind: 'assignment',
            message: `${nameOf(get().currentUserId, get().familyMembers)} 把「${task.title}」指给了你 · 截止 ${deadline}`,
            taskId,
          })
        }
        get().pushToast('已发出承接卡片到家庭群', 'success')
      },

      unacceptResponsibility: (taskId) => {
        set((s) => {
          const accepted = { ...s.accepted }
          delete accepted[taskId]
          const tasks = s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: 'needs_owner' as const, executorId: undefined }
              : t,
          )
          const mentalLoadAfter = withRedistribution(
            s.mentalLoadBefore,
            Object.keys(accepted).length,
          )
          return { accepted, tasks, mentalLoadAfter }
        })
      },

      toggleSubtask: (taskId, subtaskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id !== taskId
              ? t
              : {
                  ...t,
                  subtasks: t.subtasks.map((sub) =>
                    sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub,
                  ),
                },
          ),
        }))
      },

      setSubtaskOwner: (taskId, subtaskId, ownerId) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id !== taskId
              ? t
              : {
                  ...t,
                  subtasks: t.subtasks.map((sub) =>
                    sub.id === subtaskId ? { ...sub, ownerId } : sub,
                  ),
                },
          ),
        }))
      },

      assignAllRecommended: (taskId) => {
        const ownership: Record<string, string> = {}
        const members = get().familyMembers
        // 主任务推荐 owner（基于 category + traits），用作 subtask 兜底
        const taskForReco = get().tasks.find((t) => t.id === taskId)
        const fallbackOwner = taskForReco
          ? taskForReco.suggestedOwnerId ??
            recommendForCategoryFallback(taskForReco.category, members)
          : undefined

        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            return {
              ...t,
              // 主任务 executor 也跟着推荐
              executorId: t.executorId ?? t.suggestedOwnerId ?? fallbackOwner,
              status:
                t.status === 'needs_owner' || t.status === 'fallback_risk'
                  ? 'pending_acceptance'
                  : t.status,
              subtasks: t.subtasks.map((sub) => {
                const owner = sub.suggestedOwnerId ?? sub.ownerId ?? fallbackOwner
                if (owner) ownership[owner] = (ownership[owner] ?? '') + sub.title + ' / '
                return { ...sub, ownerId: owner }
              }),
            }
          }),
        }))
        return ownership
      },

      markTaskCompleted: (taskId) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'completed' as const,
                  subtasks: t.subtasks.map((sub) => ({ ...sub, completed: true })),
                }
              : t,
          ),
        }))
        get().pushToast('任务已标记完成', 'success')
      },

      removeTask: (taskId) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) })),

      addAttachment: (taskId, subtaskId, att) => {
        const fullAtt: TaskAttachment = {
          id: newId('att'),
          createdAt: new Date().toISOString(),
          ...att,
        }
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            if (subtaskId == null) {
              return { ...t, attachments: [...(t.attachments ?? []), fullAtt] }
            }
            return {
              ...t,
              subtasks: t.subtasks.map((sub) =>
                sub.id !== subtaskId
                  ? sub
                  : { ...sub, attachments: [...(sub.attachments ?? []), fullAtt] },
              ),
            }
          }),
        }))
      },

      // ───── family memory ─────────────────────────────
      pushFamilyMemoryEntry: (entry) =>
        set((s) => ({ familyMemoryEntries: [entry, ...s.familyMemoryEntries] })),

      resolveFamilyMemoryEntry: (entryId, resolution, extras) =>
        set((s) => ({
          familyMemoryEntries: s.familyMemoryEntries.map((e) =>
            e.id !== entryId
              ? e
              : {
                  ...e,
                  resolution,
                  resolvedAt: Date.now(),
                  resolvedTaskId: extras?.taskId ?? e.resolvedTaskId,
                  notifiedOwnerId: extras?.notifiedOwnerId ?? e.notifiedOwnerId,
                },
          ),
        })),

      clearFamilyMemoryEntries: () => set({ familyMemoryEntries: [] }),

      // ───── multi-user collaboration ──────────────────
      respondToTask: (taskId, action, reason) => {
        const responderId = get().currentUserId
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return

        const resp: TaskResponse = {
          id: newId('resp'),
          taskId,
          responderId,
          action,
          reason,
          at: Date.now(),
        }
        set((s) => ({ responses: [resp, ...s.responses] }))

        // 更新任务状态 + 通知发起人
        const assigner = task.originatorId !== responderId ? task.originatorId : 'tangning'
        const responderName = nameOf(responderId, get().familyMembers)

        if (action === 'accepted') {
          set((s) => ({
            tasks: s.tasks.map((t) => {
              if (t.id !== taskId) return t
              // 收集所有应承接的人 · 优先看子任务 ownerId · 没有子任务再看 executor
              const subAssignees = Array.from(
                new Set(
                  t.subtasks
                    .map((sub) => sub.ownerId)
                    .filter((x): x is string => !!x),
                ),
              )
              const assignees = subAssignees.length > 0
                ? subAssignees
                : t.executorId
                  ? [t.executorId]
                  : [responderId]
              const acceptedBy = Array.from(
                new Set([...(t.acceptedBy ?? []), responderId]),
              )
              const allAccepted = assignees.every((a) => acceptedBy.includes(a))
              return {
                ...t,
                acceptedBy,
                // 单人任务：设 executor · 多人任务：保持原样
                executorId: subAssignees.length === 0 ? responderId : t.executorId,
                status: allAccepted ? 'accepted' : 'pending_acceptance',
              }
            }),
          }))
          get().pushNotification({
            recipientId: assigner,
            kind: 'accepted',
            message: `${responderName} 承接了「${task.title}」`,
            taskId,
          })
          // 检查是否全员承接
          const updated = get().tasks.find((t) => t.id === taskId)
          if (updated?.status === 'accepted') {
            get().pushToast(`全员已承接「${task.title}」`, 'success')
          } else {
            const totalSubAssignees = Array.from(
              new Set(
                (updated?.subtasks ?? [])
                  .map((sub) => sub.ownerId)
                  .filter((x): x is string => !!x),
              ),
            ).length
            const acceptedCount = updated?.acceptedBy?.length ?? 0
            get().pushToast(
              totalSubAssignees > 1
                ? `已承接你的部分 · ${acceptedCount} / ${totalSubAssignees} 人确认`
                : `已承接「${task.title}」`,
              'success',
            )
          }
        } else if (action === 'rejected') {
          set((s) => ({
            tasks: s.tasks.map((t) => {
              if (t.id !== taskId) return t
              // 多人任务：只清空"这个人"的子任务 ownership，整体状态保留
              const subtasks = t.subtasks.map((sub) =>
                sub.ownerId === responderId ? { ...sub, ownerId: undefined } : sub,
              )
              const stillHasOwners = subtasks.some((sub) => sub.ownerId)
              return {
                ...t,
                subtasks,
                acceptedBy: (t.acceptedBy ?? []).filter((id) => id !== responderId),
                executorId: t.executorId === responderId ? undefined : t.executorId,
                status: stillHasOwners ? t.status : 'needs_owner',
              }
            }),
          }))
          // AI 重新推荐：避开拒绝的人 + 唐宁
          const alternatives = get().familyMembers.filter(
            (m) => m.id !== responderId && m.id !== 'tangning',
          )
          const altText =
            alternatives.length > 0
              ? `AI 建议改派 ${alternatives.slice(0, 2).map((m) => m.name).join(' / ')}`
              : '请重新分派'
          get().pushNotification({
            recipientId: assigner,
            kind: 'rejected',
            message: `${responderName} 接不了「${task.title}」${reason ? ' · ' + reason : ''} · ${altText}`,
            taskId,
          })
          get().pushToast('已告知发起人 · AI 在重新推荐', 'info')
        } else if (action === 'snoozed') {
          get().pushNotification({
            recipientId: assigner,
            kind: 'snoozed',
            message: `${responderName} 暂缓回复「${task.title}」 · 4 小时后再问`,
            taskId,
          })
          get().pushToast('已推迟，稍后会再提醒', 'info')
        }
      },

      pushNotification: (notif) =>
        set((s) => ({
          notifications: [
            {
              id: newId('notif'),
              read: false,
              at: Date.now(),
              ...notif,
            },
            ...s.notifications,
          ],
        })),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),

      markAllNotificationsRead: (recipientId) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            !recipientId || n.recipientId === recipientId
              ? { ...n, read: true }
              : n,
          ),
        })),

      // ───── system ───────────────────────────────────
      resetToSampleData: () =>
        set({
          familyMembers: FAMILY_MEMBERS,
          tasks: normalizeTasks(SAMPLE_TASKS),
          risks: SAMPLE_RISKS,
          mentalLoadBefore: MENTAL_LOAD_BEFORE.entries,
          mentalLoadAfter: MENTAL_LOAD_AFTER.entries,
          accepted: {},
          responses: [],
          notifications: [],
          familyMemoryEntries: [],
          currentUserId: 'tangning',
          uiModeOverride: 'auto',
        }),

      clearAll: () =>
        set({
          tasks: [],
          risks: [],
          accepted: {},
          responses: [],
          notifications: [],
          familyMemoryEntries: [],
          mentalLoadBefore: MENTAL_LOAD_BEFORE.entries,
          mentalLoadAfter: MENTAL_LOAD_AFTER.entries,
        }),

      // ───── toast ────────────────────────────────────
      pushToast: (message, tone = 'info') => {
        const id = newId('toast')
        set((s) => ({ toasts: [...s.toasts, { id, message, tone, ttl: 3500 }] }))
        setTimeout(() => get().removeToast(id), 3500)
      },

      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'backstage-audit:v6',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentUserId: s.currentUserId,
        hasSeenWelcome: s.hasSeenWelcome,
        uiModeOverride: s.uiModeOverride,
        familyMembers: s.familyMembers,
        tasks: s.tasks,
        risks: s.risks,
        mentalLoadBefore: s.mentalLoadBefore,
        mentalLoadAfter: s.mentalLoadAfter,
        accepted: s.accepted,
        responses: s.responses,
        notifications: s.notifications,
        familyMemoryEntries: s.familyMemoryEntries,
      }),
      // 防御性地修复老数据 —— 任何字段缺失都给一个安全默认
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.tasks = normalizeTasks(state.tasks)
        if (!Array.isArray(state.familyMembers) || state.familyMembers.length === 0) {
          state.familyMembers = FAMILY_MEMBERS
        }
        // 老数据可能没有 traits / uiMode —— 用示例家庭的同 id 补齐
        state.familyMembers = state.familyMembers.map((m) => {
          if (m.traits && m.uiMode) return m
          const seed = FAMILY_MEMBERS.find((f) => f.id === m.id)
          return {
            ...m,
            traits: m.traits ?? seed?.traits ?? [],
            uiMode: m.uiMode ?? seed?.uiMode,
          }
        })
        if (!Array.isArray(state.risks)) state.risks = SAMPLE_RISKS
        if (!Array.isArray(state.mentalLoadBefore))
          state.mentalLoadBefore = MENTAL_LOAD_BEFORE.entries
        if (!Array.isArray(state.mentalLoadAfter))
          state.mentalLoadAfter = MENTAL_LOAD_AFTER.entries
        if (!state.accepted || typeof state.accepted !== 'object') state.accepted = {}
        if (!Array.isArray(state.responses)) state.responses = []
        if (!Array.isArray(state.notifications)) state.notifications = []
        if (!Array.isArray(state.familyMemoryEntries)) state.familyMemoryEntries = []
        if (!state.uiModeOverride) state.uiModeOverride = 'auto'
        // 确保 currentUserId 存在于 familyMembers 中，否则回到第一个成员
        if (!state.familyMembers.some((m) => m.id === state.currentUserId)) {
          state.currentUserId = state.familyMembers[0]?.id ?? 'tangning'
        }
      },
    },
  ),
)

/* -------------------------------------------------------------------------- */
/* Selectors / helpers                                                        */
/* -------------------------------------------------------------------------- */

function nameOf(id: string, members: FamilyMember[]): string {
  return members.find((m) => m.id === id)?.name ?? id
}

// ⚠️ Do NOT export selectors that return filtered arrays from useAppStore.
//    Components should read raw arrays + primitives, then filter via useMemo.
//    A selector that returns `s.foo.filter(...)` makes a new array on every
//    call, breaks Zustand's snapshot caching, and causes the infinite
//    "Maximum update depth exceeded" loop.
