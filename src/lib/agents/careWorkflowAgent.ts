/**
 * Agent 2 · Care Workflow Agent
 *
 * 把一个粗粒度的任务（"周一复诊"）展开为可执行的清单。
 * 每个子任务都带：阶段（before / during / after）、推荐负责人、是否需要证明。
 */

import type { CareTask, SubTask, TaskCategory } from '../types'
import { callRemote, type LLMResponse } from '../llm/llmClient'

interface WorkflowTemplate {
  category: TaskCategory
  titleKeywords?: RegExp
  subtasks: Omit<SubTask, 'id' | 'completed'>[]
  requiredProof: string[]
}

const TEMPLATES: WorkflowTemplate[] = [
  {
    category: 'elderly_care',
    titleKeywords: /确认.*药.*(收到|送达|签收)|药.*(收到|送达|签收)/,
    subtasks: [
      { title: '留意订单是否按时送达', phase: 'before' },
      { title: '收到后确认药品名称与数量', phase: 'during' },
      { title: '拍药品照片发家庭群', phase: 'after' },
      { title: '把药放到固定位置并提醒按医嘱服用', phase: 'after' },
    ],
    requiredProof: ['药品照片或签收截图'],
  },
  {
    category: 'elderly_care',
    titleKeywords: /药|补货/,
    subtasks: [
      { title: '确认药品名称与剂量', phase: 'before' },
      { title: '确认家里剩余数量', phase: 'before' },
      { title: '是否需要处方', phase: 'before' },
      { title: '线上下单或到店购买', phase: 'during' },
      { title: '上传药品照片到家庭群', phase: 'after' },
      { title: '设置下次补货提醒', phase: 'after' },
    ],
    requiredProof: ['药品照片', '订单截图'],
  },
  {
    category: 'medical',
    titleKeywords: /复诊|门诊|高血压|心电|检查/,
    subtasks: [
      { title: '前一晚 22:00 后空腹', phase: 'before' },
      { title: '准备医保卡、蓝色文件袋、血压记录本', phase: 'before' },
      { title: '按时出门 / 到医院门口接上家人', phase: 'before' },
      { title: '问医生：近一周血压、是否调药、下次复诊时间', phase: 'during' },
      { title: '处方与缴费单拍照发家庭群', phase: 'after' },
      { title: '若调药，把药盒和医嘱拍照说明', phase: 'after' },
      { title: '报销整理（如需要）', phase: 'after' },
    ],
    requiredProof: ['处方照片', '缴费单', '调药药盒'],
  },
  {
    category: 'household_admin',
    subtasks: [
      { title: '查公众号或物业群预约时段', phase: 'before' },
      { title: '选定时段（建议周末）', phase: 'before' },
      { title: '当天在家接师傅', phase: 'during' },
      { title: '上传合格证 / 完成单据照片', phase: 'after' },
    ],
    requiredProof: ['合格证照片'],
  },
  {
    category: 'child_school',
    subtasks: [
      { title: '查清楚老师的具体要求', phase: 'before' },
      { title: '准备材料 / 作品', phase: 'before' },
      { title: '当日按时送到', phase: 'during' },
      { title: '现场拍照发家庭群', phase: 'after' },
    ],
    requiredProof: ['现场照片'],
  },
  {
    category: 'reimbursement',
    subtasks: [
      { title: '收集小票 / 处方 / 缴费单', phase: 'before' },
      { title: '按月份归档拍照', phase: 'during' },
      { title: '提交报销系统', phase: 'after' },
    ],
    requiredProof: ['报销提交截图'],
  },
  {
    category: 'general_family',
    subtasks: [
      { title: '明确具体需要做什么', phase: 'before' },
      { title: '指派一名执行人', phase: 'before' },
      { title: '执行', phase: 'during' },
      { title: '在家庭群里说一句"做完了"', phase: 'after' },
    ],
    requiredProof: [],
  },
]

function findTemplate(task: Pick<CareTask, 'category' | 'title'>): WorkflowTemplate {
  const candidates = TEMPLATES.filter((t) => t.category === task.category)
  const specific = candidates.find((t) => t.titleKeywords?.test(task.title))
  return specific ?? candidates[0] ?? TEMPLATES[TEMPLATES.length - 1]
}

export function generateWorkflow(task: Pick<CareTask, 'id' | 'category' | 'title'>): {
  subtasks: SubTask[]
  requiredProof: string[]
} {
  const tpl = findTemplate(task)
  return {
    subtasks: tpl.subtasks.map((s, idx) => ({
      ...s,
      id: `${task.id}-sub-${idx}`,
      completed: false,
      // 把模板里的 ownerId 同时记到 suggestedOwnerId（AI 推荐 / 模板预设）
      // 这样后续按"全部按推荐指派"时知道默认值
      suggestedOwnerId: s.ownerId,
    })),
    requiredProof: tpl.requiredProof,
  }
}

export async function generateCareWorkflow(
  task: Pick<CareTask, 'id' | 'category' | 'title'>,
): Promise<LLMResponse<{ subtasks: SubTask[]; requiredProof: string[] }>> {
  const fallback = generateWorkflow(task)
  return callRemote(
    `请把以下家庭任务展开成 before/during/after 清单：\n${task.title}`,
    fallback,
    '基于本地照护模板生成 · 明天可由 LLM 改写为更贴合家庭习惯的话语',
  )
}
