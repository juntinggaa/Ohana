/**
 * Agent 3 · Accountability Agent
 *
 * 这是后台审计最核心的一个 agent。
 *
 * 它做的事：
 *   - 看每条任务的承接状态
 *   - 检测"收到 / 好的 / ok" 这种模糊承接
 *   - 检测任务是否在悄悄回到发起人（fallback）
 *   - 检测发起人是否已经超载
 *   - 输出一条"可以直接发到家庭群"的追问建议
 *
 * 它不会替你说话。它只是把可以问出来的问题写好，让你点一下就发。
 */

import type { CareTask, MentalLoadEntry, ResponsibilityRisk, RawMessage } from '../types'
import { callRemote, type LLMResponse } from '../llm/llmClient'

const VAGUE_ACK = /^(收到|好的?|嗯+|ok|可以|知道了|行|没问题)[\s。.!！]*$/i

export interface AccountabilityInput {
  tasks: CareTask[]
  messages: RawMessage[]
  mentalLoadBefore: MentalLoadEntry[]
}

export function analyzeResponsibility(input: AccountabilityInput): ResponsibilityRisk[] {
  const risks: ResponsibilityRisk[] = []
  const tangningLoad = input.mentalLoadBefore.find((e) => e.memberId === 'tangning')

  input.tasks.forEach((task) => {
    // 1. 模糊承接检测
    const relatedMessages = input.messages.filter((m) =>
      task.sourceMessageIds.includes(m.id),
    )
    relatedMessages.forEach((m) => {
      if (VAGUE_ACK.test(m.body.trim())) {
        risks.push({
          id: `risk-vague-${task.id}-${m.id}`,
          taskId: task.id,
          personId: m.speakerId,
          type: 'vague_acknowledgement',
          severity: task.urgency,
          message: `${m.speakerLabel}仅回复"${m.body}"，未确认截止时间和完成证明`,
          suggestedPrompt:
            `是否要求${m.speakerLabel}确认：${task.dueDateText ?? '本周内'}前完成${
              task.requiredProof?.length
                ? ` + 上传${task.requiredProof.join(' / ')}`
                : ''
            }？`,
        })
      }
    })

    // 2. 缺截止时间
    if (!task.dueDateText) {
      risks.push({
        id: `risk-deadline-${task.id}`,
        taskId: task.id,
        type: 'missing_deadline',
        severity: 'medium',
        message: `任务「${task.title}」没有明确截止时间`,
        suggestedPrompt: '请发起人确认一个具体日期，否则任务会无限延期。',
      })
    }

    // 3. 缺证明
    if (
      (task.status === 'accepted' || task.status === 'in_progress') &&
      (!task.requiredProof || task.requiredProof.length === 0)
    ) {
      risks.push({
        id: `risk-proof-${task.id}`,
        taskId: task.id,
        personId: task.executorId,
        type: 'missing_proof',
        severity: 'low',
        message: `任务「${task.title}」未约定完成证明`,
        suggestedPrompt: '建议在任务卡片加一条：完成后上传照片或截图。',
      })
    }

    // 4. 回到发起人
    if (task.status === 'fallback_risk') {
      risks.push({
        id: `risk-fallback-${task.id}`,
        taskId: task.id,
        personId: task.executorId ?? task.originatorId,
        type: 'fallback_to_originator',
        severity: 'high',
        message: `任务正在悄悄回到${task.executorId === 'tangning' ? '唐宁' : '发起人'}`,
        suggestedPrompt:
          task.suggestedOwnerId
            ? `建议把任务正式转给${task.suggestedOwnerId === 'bro' ? '弟弟' : task.suggestedOwnerId}，并要求他确认承接（含截止 + 证明）。`
            : '建议立即明确一名执行人，否则唐宁会兜底。',
      })
    }

    // 5. 发起人超载
    if (tangningLoad && tangningLoad.percentage > 0.6 && task.suggestedOwnerId === 'tangning') {
      risks.push({
        id: `risk-overload-${task.id}`,
        taskId: task.id,
        personId: 'tangning',
        type: 'overloaded_originator',
        severity: 'high',
        message: `唐宁本周心智负担已达 ${(tangningLoad.percentage * 100).toFixed(0)}%，建议把这条交出`,
        suggestedPrompt: '建议改派给同城弟弟或在家的周勉。',
      })
    }
  })

  return risks
}

export async function analyzeResponsibilityTransfer(
  input: AccountabilityInput,
): Promise<LLMResponse<ResponsibilityRisk[]>> {
  const fallback = analyzeResponsibility(input)
  return callRemote(
    '分析以下任务的责任归属风险',
    fallback,
    '本地规则引擎 · 明天可替换为对话式 LLM 推理',
  )
}

/**
 * 把一条"收到"转换为一条结构化承接 —— UI 的 Accept Responsibility 流程的后端。
 */
export interface AcceptedResponsibility {
  taskId: string
  ownerId: string
  deadline: string
  proofRequired: string[]
}

export function acceptResponsibility(
  task: CareTask,
  ownerId: string,
  deadline: string,
): AcceptedResponsibility {
  return {
    taskId: task.id,
    ownerId,
    deadline,
    proofRequired: task.requiredProof ?? [],
  }
}
