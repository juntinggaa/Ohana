# Agent 架构

后台审计由三个协同的 Agent 组成。每个 Agent 都有：

- **明确的输入边界**
- **结构化的输出**
- **本地确定性版本（无 API Key 即可跑）**
- **可替换的 LLM 通道（明天接真实模型只改一个文件）**

```
┌─────────────────────────┐
│ 混乱多平台原始消息          │
│ 家庭群 / 医院 / 学校 / 物业 │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Agent 1 · Task Capture   │  ← src/lib/agents/taskCaptureAgent.ts
│  识别真任务、分类、紧迫度    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Agent 2 · Care Workflow  │  ← src/lib/agents/careWorkflowAgent.ts
│  展开为 before/during/after │
│  推荐每段的执行人            │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ Agent 3 · Accountability │  ← src/lib/agents/accountabilityAgent.ts
│  检测："收到"模糊承接、       │
│   缺截止、缺证明、            │
│   掉回发起人、发起人超载       │
│  输出可直接发送的追问句       │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│ UI · 责任交接 + 心智负担     │
│  让家庭看到，并真的分配          │
└─────────────────────────┘
```

## Agent 1 · Task Capture Agent

### 输入

- 一段任意文本（家庭群粘贴 / OCR 截图 / 手动输入）
- 或结构化的 `RawMessage[]`

### 输出（`CapturedTask[]`）

- `title` `category` `urgency` `originatorId`
- `suggestedOwnerId` `suggestionReason`
- `requiredProof` `aiExplanation`
- `matchedLine` `matchedKeywords` `confidence`

### MVP 实现

基于 6 类家庭照护模式（老人药品 / 医院复诊 / 物业家务 / 学校任务 / 报销票据 / 一般家事）做关键词匹配 + 上下文窗口 + 紧迫度提升关键词。

### 明天替换为真实 LLM 时

`analyzeFamilyMessages()` 已是 async wrapper，直接走 `callRemote()`。

Prompt 设计建议：

```text
You are a family care coordinator AI. Given the following Chinese family
messages from group chats, hospital reminders, school notices and property
notifications, extract all *real* care tasks. For each task, output:
  - title
  - category (one of: elderly_care, medical, child_school, household_admin, reimbursement, general_family)
  - urgency (low/medium/high)
  - originatorId (who said it)
  - suggestedOwnerId (who should do it)
  - suggestionReason (one sentence)
  - requiredProof[]

Important: a casual mention like "你爸药快没了" IS a task. A reply like
"收到" is NOT acceptance. Flag those tasks as fallback_risk.
```

---

## Agent 2 · Care Workflow Agent

### 输入

一个 `CareTask`（来自 Agent 1）

### 输出

`{ subtasks: SubTask[], requiredProof: string[] }`

每个 `SubTask` 带 `phase: 'before' | 'during' | 'after' | 'general'` 和可选 `ownerId`。

### MVP 实现

按 category + title 关键词命中本地模板。当前提供 6 类模板，覆盖最常见的家庭照护场景。

### 明天替换为真实 LLM 时

Prompt 设计建议：

```text
Given a care task with title and category, generate a phase-grouped checklist.
Each subtask must be small enough that a non-coordinator can do it without
asking back. Prefer specific numbers over vague language:
  - "前一晚 22:00 后空腹" not "记得空腹"
  - "处方与缴费单拍照发家庭群" not "保存好票据"
```

---

## Agent 3 · Accountability Agent

### 输入

- 当前所有任务
- 当前所有原始消息
- 当前心智负担快照（before）

### 输出（`ResponsibilityRisk[]`）

5 类风险：

1. `vague_acknowledgement` —— 检测到"收到"等模糊承接
2. `missing_deadline`
3. `missing_proof`
4. `fallback_to_originator` —— 任务在悄悄回到发起人
5. `overloaded_originator` —— 发起人心智负担已 > 60%

每条风险附 `suggestedPrompt` —— 一句可以直接发到家庭群的话。

### MVP 实现

- 模糊承接：正则 `/^(收到|好的?|嗯+|ok|可以|知道了|行|没问题)[\s。.!！]*$/i`
- 兜底检测：任务 `executorId === 'tangning'` 且 `suggestedOwnerId !== 'tangning'`
- 超载检测：`tangning.percentage > 0.6`

### 明天替换为真实 LLM 时

可以用 LLM 重写 `suggestedPrompt`，让语气更贴合当前家庭的对话风格。

例：把生硬的"是否要求弟弟确认截止时间"改成"老弟，下午有空跑一趟药店吗？拍张药盒发我就行"。

---

## 数据流总结

```ts
const rawText = '混乱的家庭消息……'

// Agent 1
const captured = await analyzeFamilyMessages(rawText)

// Agent 2 (对每个任务)
const workflows = await Promise.all(
  captured.data.map(t => generateCareWorkflow(t)),
)

// Agent 3
const risks = await analyzeResponsibilityTransfer({
  tasks,
  messages,
  mentalLoadBefore: MENTAL_LOAD_BEFORE.entries,
})

// 心智负担 = 纯数学，不需要 LLM
const after = redistribute(MENTAL_LOAD_BEFORE, captured.data)
```

---

## 为什么不是单个大 Agent

- 三个 Agent 的输入 / 输出是不同维度的，分开更容易测试和迭代
- Accountability Agent 经常需要看完整任务列表 + 心智负担，单独让它跑能复用
- 明天若要支持 voice intake / OCR，只动 Agent 1
- 每个 Agent 的 prompt 都可以独立调，避免一个改动影响全部
