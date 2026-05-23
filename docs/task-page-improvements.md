# Task Page Improvements · 后台审计

This pass reshapes the app from a single-coordinator dashboard into a multi-role
family coordination tool. Tang Ning is no longer the only person the AI talks to.

---

## 1. AI Assignment Flow (Fixed)

**Before:** clicking `全部按 AI 推荐指派` immediately popped open the message-share
modal, but did not always fill subtask assignees first if a subtask had no
`suggestedOwnerId`.

**Now:**

1. `全部按 AI 推荐指派` fills each subtask's `ownerId` inline. If a subtask has
   no template suggestion, it falls back to the trait-aware assignment agent
   (`src/lib/agents/assignmentAgent.ts`).
2. A toast confirms which family members were chosen.
3. A separate `确认指派并生成通知` button opens the new
   `AssignAllModal` with grouped per-person messages.
4. The modal has:
   - `复制给XX`
   - `复制全部消息`
   - `模拟发送` (pushes in-app notifications)
   - `自动发送（待集成）` (disabled placeholder)
   - `确认并标记已发送` (primary action)

Originator logic is now distinct from owner/executor:

- `originatorId` – who first surfaced it (妈妈 / 唐宁 / ... / `'system'`)
- `originatorLabel` – more specific channel label (`'医院提醒'`, `'幼儿园通知'`,
  `'物业通知'`, `'唐宁脑中'`)
- `suggestedOwnerId` – AI's recommended owner
- `executorId` – who actually owns it now

---

## 2. Family Traits

`FamilyMember` now has a `traits: string[]` field. Seeded examples:

| 成员  | Traits                                              |
| --- | --------------------------------------------------- |
| 唐宁  | 统筹 / 票据整理 / 医疗行政 / 已超载                              |
| 妈妈  | 在家时间多 / 会拍照 / 了解爸爸状况 / 不太会用 App                     |
| 爸爸  | 被照护对象 / 需要陪诊 / 血压监测中                                |
| 弟弟  | 同城父母 / 可跑腿 / 会陪诊 / 能买药 / 不擅长发起                      |
| 周勉  | 同城唐宁 / 家务行政 / 日历可靠 / 可对接师傅 / 能拍照上传                  |
| 小棠  | 只能做简单事 / 不可承接医疗 / 行政                                |

Traits drive the assignment agent. For example:

- `老人药品补货` → prefers `同城父母` + `可跑腿`
- `家务行政` → prefers `家务行政` + `日历可靠` + `可对接师傅`
- 唐宁 is intentionally de-prioritized (`-5`) so the system doesn't default to her;
  `已超载` traits subtract more.

Editing traits lives on `/family` via `FamilyTraitsEditor`. The editor offers
20+ suggestion chips and a free-text input.

---

## 3. Three-color Status System

`src/lib/status.ts` centralizes status → tone mapping. Everything previously
using rouge/moss/ink ad-hoc now reads from this one map.

| Tone   | Statuses                                                  |
| ------ | --------------------------------------------------------- |
| red    | `needs_owner`, `pending_acceptance`, `fallback_risk`      |
| yellow | `detected`, `needs_proof`                                 |
| green  | `accepted`, `in_progress`                                 |
| neutral| `completed`                                               |

Each status also has both a `simpleLabel` (家人语言) and `proLabel` (唐宁语言).

---

## 4. Profile-Aware Tasks Page

`/tasks` now respects the current user:

- Default for coordinator: full family view
- Default for executor / elder: only tasks where the user is originator,
  executor, suggested owner, verifier, or assigned to any subtask
- Top-right toggle: `只看与我有关` ↔ `全家视图`
- Header now shows `当前身份：XX · 只显示与你有关的 N 条`

---

## 5. Simple / Pro Mode Toggle

`ModeToggle` lives in the header. Options:

- `自动` – derives mode from current user's `uiMode`
- `专业模式` (`coordinator`) – Tang Ning view: dashboard, mental load, all explanations
- `简单模式` (`executor`) – Brother / Zhou view: my-tasks, big accept/upload buttons
- `老人模式` (`elder`) – Mom / Dad / kid view: even simpler text, hides risks panel

Simple/elder modes:

- Replace `心智负担 / 发起人 / 执行人 / 完成证明` with `谁先提到 / 谁来做 / 拍张照片 ...`
- Hide raw chat messages, risk lists, and AI confidence chatter
- Default landing page becomes `/today`

---

## 6. Today Home (`/today`)

A new low-noise landing page with three sections:

1. **今天要做** – tasks related to you that are due today / this week
2. **需要你确认** – tasks where you're suggested owner / executor but haven't accepted
3. **家里可能会漏掉的事** – top 4 unresolved risks from the risks store
   (hidden in elder mode)

`<RootRedirect>` in `App.tsx` sends coordinators to `/dashboard` and everyone
else to `/today`.

---

## 7. Family Memory Chat (`/memory`)

The piece that breaks the "Tang Ning is the only one talking to the AI" pattern.

Every family member can open `/memory`, switch to their identity in the side
panel, and type / use a quick prompt. The agent in
`src/lib/agents/familyMemoryAgent.ts` classifies the message into one of:

- `new_task` – 配药 / 复诊 / 家务 / 学校
- `risk_signal` – 血压 / 头晕 etc.
- `availability_update` – 我这周末有空 ...
- `redistribution_request` – 唐宁说"重新分配"
- `care_note` / `question` – everything else

The AI's reply card shows:

- Detected intent + plain-language summary
- Suggested task title, owner (with trait-aware reasoning), subtasks, deadline
- Buttons: `创建任务` / `更新现有任务` / `通知相关家人` / `忽略`

Voice input and image upload are placeholders that toast `Speech-to-Text /
OCR 待集成` and inject a sample line for demos.

---

## 8. Calendar / Maps / Attachments

`TaskDetailModal` now offers:

- `导出 .ics` – downloads a local `.ics` file (works today, no API key needed)
- `Google Maps` / `Apple 地图` – opens external maps with `locationName` /
  `locationAddress` as the query
- `拍照上传` (camera button on task & subtask attachments via `addAttachment`)
  – uses `URL.createObjectURL`; no backend needed for the MVP

`.env.example` already covers DeepSeek + Mistral OCR; we'll add
`SPEECH_TO_TEXT_API_KEY` placeholder when the STT integration ships.

---

## 9. Originator Logic Refinements

`mockData.ts` now sets `originatorLabel` per task:

- 妈妈 → `originatorLabel: '妈妈'`
- 医院 → `originatorLabel: '医院提醒'`
- 物业 → `originatorLabel: '物业通知'`
- 学校 → `originatorLabel: '幼儿园通知'`
- 唐宁脑中 (in-her-head only) → `originatorLabel: '唐宁脑中'`

The new `OriginatorLabel` component renders:

- a real `FamilyMember` (avatar + name) when the id matches a member
- a bell icon + label for system channels
- never the bare string `'system'` anywhere user-facing

---

## 10. Store Changes

New fields and actions in `src/lib/store.ts`:

- `uiModeOverride: 'auto' | 'coordinator' | 'executor' | 'elder'`
- `familyMemoryEntries: FamilyMemoryEntry[]`
- `addTrait(memberId, trait)` / `removeTrait(memberId, trait)`
- `addAttachment(taskId, subtaskId | null, attachment)`
- `pushFamilyMemoryEntry(entry)` / `clearFamilyMemoryEntries()`
- `setUiModeOverride(mode)`

Persist namespace bumped to `backstage-audit:v4` so stale `v3` data with the old
shape gets cleanly migrated.

---

## 11. Future Wiring

| Surface             | Today                      | When you wire it                 |
| ------------------- | -------------------------- | -------------------------------- |
| Family Memory Chat  | Deterministic mock         | Swap `processFamilyMemoryMessage` for DeepSeek JSON mode |
| Voice input         | Toast + sample line        | Web Speech API or external STT key |
| Image OCR           | Toast + filename echo      | Mistral OCR (already configured) |
| Calendar            | `.ics` download            | Google Calendar / Apple OAuth    |
| Maps                | `https://maps.…` deep link | Embedded map preview             |
| Auto-send to群       | Disabled placeholder       | WhatsApp / WeChat / Telegram     |

---

## 12. Manual Smoke Checklist (3 minutes)

1. `npm run dev` → open `http://localhost:5173/`
2. Land on Today as Tang Ning (you'll be redirected to `/dashboard` because she's a coordinator)
3. Header → `Mode = 简单模式` to see the executor view
4. Header → `UserSwitcher → 弟弟` and confirm `/today` shows only his tasks
5. Open `爸爸周一高血压复诊`
6. Click `全部按 AI 推荐指派` — confirm all subtasks now have owners
7. Click `确认指派并生成通知` — confirm per-person messages
8. Click `模拟发送` — confirm notifications fire for each owner
9. Open `/memory`, switch to 妈妈, paste `你爸最近早上血压有点高，但是他说没事。`
10. Confirm AI suggests blood-pressure tracking subtasks, click `创建任务`,
    then go to `/tasks` and verify the task appears
11. Open `/family`, add a trait to one member; reopen the same task and click
    `全部按 AI 推荐指派` again — the reasoning string updates accordingly
