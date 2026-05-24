import { callDeepSeek, callRemoteWithFallback, type LLMResponse } from '../llm/llmClient'
import type {
  HouseholdMemory,
  HouseholdMemoryCategory,
} from '../types'

export interface FamilyAnswer {
  text: string
  memoryIds: string[]
}

type HouseholdMemoryDraft = Omit<HouseholdMemory, 'id' | 'createdAt'>

const TOPIC_KEYWORDS = [
  ['医药卡', '医保卡', '医疗卡', '就诊卡'],
  ['复诊', '看病', '门诊', '预约'],
  ['药', '用药', '药盒', '处方'],
  ['钥匙', '门禁卡'],
  ['证件', '身份证', '户口本'],
  ['电话', '联系方式'],
]

function cleanText(text: string): string {
  return text.replace(/^请记住[：:\s]*/, '').trim()
}

function distinct(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}

function categoryFor(text: string): HouseholdMemoryCategory {
  if (/放在|收在|收好|抽屉|柜|袋|盒|哪里|位置/.test(text)) return 'location'
  if (/复诊|门诊|挂号|预约|医院|检查/.test(text)) return 'appointment'
  if (/药|血压|血糖|过敏|健康/.test(text)) return 'health'
  if (/电话|联系方式|地址/.test(text)) return 'contact'
  if (/每周|每天|习惯|轮流/.test(text)) return 'routine'
  return 'other'
}

function titleFor(text: string): string {
  if (/医药卡|医保卡|医疗卡|就诊卡/.test(text)) return '医药卡在哪里'
  if (/复诊|门诊|预约/.test(text) && /带|准备|资料/.test(text)) return '复诊要带什么'
  if (/药盒|药放|用药/.test(text)) return '药品放在哪里'
  if (/钥匙|门禁卡/.test(text)) return '钥匙和门禁卡'
  const first = text.split(/[，。！？!?]/)[0]?.trim() ?? text
  return first.length > 16 ? `${first.slice(0, 15)}...` : first
}

function keywordsFor(text: string, title: string): string[] {
  const keywords = [title]
  TOPIC_KEYWORDS.forEach((group) => {
    if (group.some((word) => text.includes(word) || title.includes(word))) {
      keywords.push(...group)
    }
  })
  return distinct(keywords)
}

export function isRememberableFamilyFact(text: string): boolean {
  if (/[?？]$/.test(text.trim())) return false
  return (
    /^请记住/.test(text.trim()) ||
    /(医药卡|医保卡|就诊卡|证件|钥匙|门禁卡|药盒|复诊资料).*(放在|收在|装在|留在)/.test(text) ||
    /(复诊|门诊|预约).*(需要带|请带|要带|时间是)/.test(text)
  )
}

export function draftHouseholdMemory(
  rawText: string,
  createdById?: string,
  sourceMessageId?: string,
): HouseholdMemoryDraft {
  const detail = cleanText(rawText)
  const title = titleFor(detail)
  return {
    title,
    detail,
    category: categoryFor(detail),
    keywords: keywordsFor(detail, title),
    createdById,
    sourceMessageId,
  }
}

function relevanceScore(question: string, memory: HouseholdMemory): number {
  let score = 0
  if (question.includes(memory.title)) score += 8
  memory.keywords.forEach((keyword) => {
    if (question.includes(keyword)) score += 4
  })
  TOPIC_KEYWORDS.forEach((group) => {
    const queryMatches = group.some((word) => question.includes(word))
    const noteMatches = group.some((word) => memory.detail.includes(word))
    if (queryMatches && noteMatches) score += 3
  })
  return score
}

function relevantMemories(question: string, memories: HouseholdMemory[]): HouseholdMemory[] {
  return memories
    .map((memory) => ({ memory, score: relevanceScore(question, memory) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.memory)
}

function localAnswer(question: string, memories: HouseholdMemory[]): FamilyAnswer {
  const found = relevantMemories(question, memories)
  if (found.length > 0) {
    const recorded = found.map((memory) => memory.detail).join('；')
    const safetyLine = /复诊|医院|看病|门诊/.test(question)
      ? ' 出发前也可以再对照医院通知确认一次。'
      : ''
    return {
      text: `我在家中记忆里找到：${recorded}${safetyLine}`,
      memoryIds: found.map((memory) => memory.id),
    }
  }

  if (/复诊|医院|看病|门诊/.test(question) && /带|准备|什么/.test(question)) {
    return {
      text: '家中记忆还没有这次复诊的确定清单。一般可以先核对医药卡、预约通知和近期用药记录，具体以医院通知为准；知道的家人可以把清单记进记忆本。',
      memoryIds: [],
    }
  }

  if (/好吗|怎么样|开心|想念|在吗/.test(question)) {
    return {
      text: '这句更适合发到家庭聊天里，让家人亲自回应你。切回「发给家人」就可以留下来。',
      memoryIds: [],
    }
  }

  return {
    text: '我还没有在家中记忆里找到答案。知道的家人可以发一句「请记住：……」，保存后我就能替大家找回来。',
    memoryIds: [],
  }
}

export async function answerFromHouseholdMemory(args: {
  question: string
  memories: HouseholdMemory[]
  useRemoteAI?: boolean
}): Promise<LLMResponse<FamilyAnswer>> {
  const fallback = localAnswer(args.question, args.memories)
  if (!args.useRemoteAI) {
    return {
      mode: 'mock',
      data: fallback,
      mockNote: '根据本地家中记忆作答',
    }
  }
  const matched = relevantMemories(args.question, args.memories)
  const context = matched.length > 0
    ? matched.map((memory) => `- ${memory.title}: ${memory.detail}`).join('\n')
    : '- 没有匹配到家人确认过的记忆'

  return callRemoteWithFallback({
    fallback,
    mockNote: '根据家中记忆作答',
    remote: async () => {
      const text = await callDeepSeek({
        system: [
          '你是温柔、克制的家庭记忆助手。',
          '涉及物品位置、预约安排或家人私人事实时，只能依据提供的家中记忆回答；没有记录就明确说不知道。',
          '涉及就医准备时，可提示核对医院通知，不提供诊断。',
          '回答使用简短自然的简体中文，不要创造任务或派人做事。',
        ].join('\n'),
        user: `家中记忆：\n${context}\n\n家人的问题：${args.question}`,
        temperature: 0.2,
      })
      return {
        text,
        memoryIds: matched.map((memory) => memory.id),
      }
    },
  })
}
