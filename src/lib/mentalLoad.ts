import type { FamilyMember, MentalLoadEntry, WeeklyMentalLoadSnapshot } from './types'

/**
 * 心智负担评分公式 · Mental Load Score
 *
 *   score = originated * 3
 *         + followUps  * 2
 *         + verified   * 2
 *         + fallbacks  * 4
 *         + executed   * 1
 *
 * 设计意图：
 *   - 真正"想到并安排"的劳动（originate / follow-up / verify）权重更高
 *   - 单纯执行（execute）权重最低，因为执行已经被广泛承认
 *   - 兜底（fallback）权重最高 —— 任务掉回某个人，是隐形劳动最重的一击
 */
export function calcMentalLoadScore(input: {
  originated: number
  executed: number
  followUps: number
  verified: number
  fallbacks: number
}): number {
  return (
    input.originated * 3 +
    input.followUps * 2 +
    input.verified * 2 +
    input.fallbacks * 4 +
    input.executed * 1
  )
}

export function buildSnapshot(
  members: FamilyMember[],
  raw: Record<string, Omit<MentalLoadEntry, 'memberId' | 'score' | 'percentage'>>,
  label: string,
): WeeklyMentalLoadSnapshot {
  const withScore = members.map((m): MentalLoadEntry => {
    const r = raw[m.id] ?? {
      originated: 0,
      executed: 0,
      followUps: 0,
      verified: 0,
      fallbacks: 0,
    }
    return {
      memberId: m.id,
      ...r,
      score: calcMentalLoadScore(r),
      percentage: 0,
    }
  })
  const total = withScore.reduce((sum, e) => sum + e.score, 0) || 1
  withScore.forEach((e) => (e.percentage = e.score / total))
  return { label, entries: withScore }
}
