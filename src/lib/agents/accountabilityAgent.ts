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
          message: `${m.speakerLabel}回复了"${m.body}"，也许还可以温柔地问问什么时候方便`,
          suggestedPrompt:
            `可以问问${m.speakerLabel}：是否方便在${task.dueDateText ?? '本周内'}帮忙${
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
        message: `「${task.title}」还不知道什么时候能放心`,
        suggestedPrompt: '可以在群里问一句：这件事大概什么时候方便照看好？',
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
        message: `「${task.title}」完成后还可以留一个让大家安心的回音`,
        suggestedPrompt: '完成后方便分享一张照片或一句消息吗？大家会放心些。',
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
        message: '这份牵挂又落在同一个人心里了 · 可以问问谁有余裕',
        suggestedPrompt:
          task.suggestedOwnerId
            ? `可以问问${task.suggestedOwnerId === 'bro' ? '弟弟' : task.suggestedOwnerId}最近是否方便陪着处理，让惦记的人松一口气。`
            : '可以在家里轻轻问一句：这次谁比较方便陪着处理？',
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
        message: '同一个人最近心里装了比较多家里的事 · 也许需要有人主动帮一把',
        suggestedPrompt: '可以先问问同城的弟弟，或者在家的周勉，最近是否方便帮忙。',
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
