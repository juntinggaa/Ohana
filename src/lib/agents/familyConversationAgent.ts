import {
  callDeepSeek,
  callRemoteWithFallback,
  type LLMChatMessage,
  type LLMResponse,
} from '../llm/llmClient'
import type {
  HouseholdMemory,
  HouseholdMemoryCategory,
  HouseholdMemoryVisibility,
  TaskCategory,
} from '../types'

export interface FamilyAnswer {
  text: string
  memoryIds: string[]
}

type HouseholdMemoryDraft = Omit<HouseholdMemory, 'id' | 'createdAt'>

export interface CareRequestDraft {
  title: string
  category: TaskCategory
  dueDateText?: string
}

const TOPIC_KEYWORDS = [
  ['医药卡', '医保卡', '医疗卡', '就诊卡', 'yiyao ka', 'yiyaoka', 'medical card'],
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
    /(医药卡|医保卡|就诊卡|证件|钥匙|门禁卡|药盒|复诊资料).*(在|收好|存于)/.test(text) ||
    /(复诊|门诊|预约).*(需要带|请带|要带|时间是)/.test(text)
  )
}

export function draftHouseholdMemory(
  rawText: string,
  createdById?: string,
  sourceMessageId?: string,
  visibility: HouseholdMemoryVisibility = 'family',
  sharedWithIds?: string[],
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
    visibility,
    sharedWithIds,
    confirmedAt: Date.now(),
  }
}

export function canViewHouseholdMemory(
  memory: HouseholdMemory,
  currentUserId: string,
): boolean {
  if (!memory.visibility || memory.visibility === 'family') return true
  if (memory.createdById === currentUserId) return true
  if (memory.visibility === 'private') return false
  return (memory.sharedWithIds ?? []).includes(currentUserId)
}

export function isCareRequestCandidate(text: string): boolean {
  return /(谁方便|能不能帮|可以帮|帮忙|陪着|陪我|陪爸|陪妈|药.*(快没|没了|补|买)|复诊.*(陪|准备|带)|血压.*(高|低)|头晕|胸闷|燃气.*(检|修)|接孩子)/.test(text)
}

export function draftCareRequest(text: string): CareRequestDraft | null {
  if (!isCareRequestCandidate(text)) return null
  if (/药.*(快没|没了|补|买)/.test(text)) {
    return { title: '为家人补好药品', category: 'elderly_care', dueDateText: '今晚前' }
  }
  if (/复诊|看病|医院|门诊/.test(text)) {
    return { title: '陪家人安心复诊', category: 'medical', dueDateText: '到预约日' }
  }
  if (/血压|头晕|胸闷/.test(text)) {
    return { title: '留意家人的身体感受', category: 'elderly_care', dueDateText: '今天' }
  }
  if (/燃气|维修|物业/.test(text)) {
    return { title: '照看家中检修', category: 'household_admin', dueDateText: '本周内' }
  }
  if (/接孩子|学校|幼儿园/.test(text)) {
    return { title: '陪孩子处理学校安排', category: 'child_school', dueDateText: '到截止日' }
  }
  return { title: text.slice(0, 18), category: 'general_family' }
}

function relevanceScore(question: string, memory: HouseholdMemory): number {
  const normalizedQuestion = question.toLowerCase()
  const normalizedTitle = memory.title.toLowerCase()
  const normalizedDetail = memory.detail.toLowerCase()
  let score = 0
  if (normalizedQuestion.includes(normalizedTitle)) score += 8
  memory.keywords.forEach((keyword) => {
    if (normalizedQuestion.includes(keyword.toLowerCase())) score += 4
  })
  TOPIC_KEYWORDS.forEach((group) => {
    const queryMatches = group.some((word) => normalizedQuestion.includes(word.toLowerCase()))
    const noteMatches = group.some((word) => normalizedDetail.includes(word.toLowerCase()))
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

function localMemoryAnswer(question: string, memories: HouseholdMemory[]): FamilyAnswer {
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
    text: '我还没有在家中记忆里找到答案。目前没有连上 AI，知道的家人可以在聊天里说出这条信息，再点「保存到记忆本」。',
    memoryIds: [],
  }
}

export async function answerFromOhana(args: {
  question: string
  memories: HouseholdMemory[]
  history?: LLMChatMessage[]
}): Promise<LLMResponse<FamilyAnswer>> {
  const fallback = localMemoryAnswer(args.question, args.memories)
  const matched = relevantMemories(args.question, args.memories)
  const context = matched.length > 0
    ? matched.map((memory) => `- ${memory.title}: ${memory.detail}`).join('\n')
    : '- 没有匹配到家人确认过的记忆'

  return callRemoteWithFallback({
    fallback,
    mockNote: 'AI 未连接时仅根据家中记忆作答',
    remote: async () => {
      const text = await callDeepSeek({
        system: [
          '你是欧哈娜，一位温暖、可靠的家庭对话助手。',
          '你可以回答一般生活问题、情绪支持问题和通识健康问题，也可以依据家庭记忆回答家中具体事实。',
          '涉及家中物品位置、证件、预约安排或家人私人事实时，只能依据提供的家庭记忆；没有记录就明确说不知道，不要猜测。',
          '涉及健康、治疗、化疗或用药时，提供简短的一般信息和就医提醒，不做诊断，不替代医疗团队；有紧急症状时建议及时求助。',
          '涉及附近、最近、门店或实时信息时，如果没有确切地点或实时查询结果，请询问所在位置或说明无法判断最近，不要编造店名。',
          '家庭记忆与问题无关时，不要强行引用它。',
          '用自然、易懂的简体中文回答，通常保持简短。',
        ].join('\n'),
        history: args.history,
        user: `可参考的家庭记忆（仅在与问题有关时使用）：\n${context}\n\n家人的问题：${args.question}`,
        temperature: 0.2,
      })
      return {
        text,
        memoryIds: matched.map((memory) => memory.id),
      }
    },
  })
}
