# 欧哈娜 · Ohana

> **"欧哈娜不是一个待办清单，是一个家庭共同的记忆与责任。"**
> Ohana is not a to-do list. It is a shared family brain for memory and care.

Ohana 在夏威夷语里就是"家人" —— 不让任何一个人独自扛着。

---

## 一、产品定位

**欧哈娜** 是一个 AI 家庭照护 Agent，把混乱的家庭消息（家庭群、医院提醒、学校通知、物业短信）转化成 **可执行、可追踪、温和分担的责任流程**，让一直在记住、协调、兜底的那个人不再孤单。

灵感来自《故事五夜·第五夜：待办家事》中的唐宁 —— 36 岁互联网运营经理，夹心层照护者，是父母、孩子、伴侣三方系统的隐形"后台管理员"。

## 二、痛点 · 关键洞察

- 常见家庭日历（Cozi / FamilyWall / 飞书家庭）追踪 **"谁执行了任务"**。
- 但没有一个产品追踪 **"谁一直在想到、安排、追问、核对、兜底"**。
- 在唐宁的家里，弟弟回一句"收到"，妈妈说"别管了早点睡"，看起来都没问题；但任务最终又会回到唐宁。
- 我们要做的，不是让唐宁更高效，而是让 **家庭看到后台劳动，并真正分配它**。

## 三、MVP 功能

| # | 模块 | 文件 | 用一句话讲 |
| - | -- | -- | -- |
| A | Task Capture Agent | `src/lib/agents/taskCaptureAgent.ts` | 把混乱消息拆成结构化任务（关键词 + 上下文，无 API Key 也能跑） |
| B | Care Workflow Agent | `src/lib/agents/careWorkflowAgent.ts` | 把一条任务展开成 before / during / after 的清单 |
| C | Accountability Agent | `src/lib/agents/accountabilityAgent.ts` | 识别"收到"等模糊承接，写好可直接发的追问 |
| D | Mental Load Dashboard | `src/components/MentalLoadDashboard.tsx` | 心智负担打分 + before/after 切换 |
| E | Task Detail Modal | `src/components/TaskDetailModal.tsx` | 看 AI 解读、子任务、风险点、承接按钮 |
| F | Pitch Mode | `src/pages/PitchMode.tsx` | 黑客松演讲专用全屏幻灯模式 |

## 四、心智负担公式

```
心智负担 = 想到 × 3 + 追问 × 2 + 核对 × 2 + 兜底 × 4 + 执行 × 1
```

设计意图：

- **兜底权重最高（×4）**：任务掉回某个人，是最隐形也最磨人的劳动。
- **执行权重最低（×1）**：执行已经被广泛承认，不需要再放大。
- **想到 / 追问 / 核对（×3 / ×2 / ×2）**：把"在脑子里运转"这件事第一次有数。

## 五、技术栈

- **Vite + React + TypeScript + Tailwind CSS** —— 启动 1 秒，HMR 极快
- **lucide-react** 图标
- **react-router-dom** 五个页面（总览 / 收件箱 / 任务 / 心智负担 / Pitch）
- **本地确定性逻辑** —— 完全不依赖任何 LLM API Key
- **可替换 LLM 通道** —— `src/lib/llm/llmClient.ts` 已写好接口，明天接 DeepSeek / Claude 只改这一个文件

## 六、本地运行

```bash
cd hackhaton
npm install   # 若已安装可跳过
npm run dev
```

浏览器会自动打开 `http://localhost:5173`。

构建产物：

```bash
npm run build      # 生成 dist/
npm run preview    # 本地预览生产构建
```

## 七、Demo 流程（建议 2~3 分钟）

1. **总览 (Dashboard)** —— 直接给评委看四张数据卡：模糊承接 / 掉回唐宁 / 待证明 / 可转移
2. **AI 收件箱 (Inbox)** —— 点「AI 识别任务」，看混乱聊天被切成结构化任务，附置信度和命中关键词
3. **家庭任务 (Tasks)** —— 点开"爸爸降压药补货"，展示 before/during/after 拆解 + AI 推荐执行人
4. **心智负担 (Mental Load)** —— 切换 before/after，唐宁 84% → 30%
5. **Pitch Mode** —— 直接全屏演讲

详细脚本见 `docs/demo-script.md`。

## 八、文件结构

```
hackhaton/
├─ README.md                          ← 你现在看到的
├─ .env.example                       ← 可选 API Key（明天接真实模型）
├─ package.json
├─ vite.config.ts
├─ tailwind.config.js
├─ index.html
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ index.css                       ← 全局样式 + 设计 tokens
│  ├─ components/
│  │  ├─ Layout.tsx                   ← 侧边栏 + 主区
│  │  ├─ Avatar.tsx
│  │  ├─ MemberPill.tsx
│  │  ├─ PageHeader.tsx
│  │  ├─ StatCard.tsx
│  │  ├─ FamilyChatInput.tsx          ← 粘贴混乱消息 → AI 识别
│  │  ├─ TaskCard.tsx
│  │  ├─ TaskDetailModal.tsx          ← 含责任承接按钮
│  │  ├─ MentalLoadDashboard.tsx      ← before/after 切换 + bar chart
│  │  └─ ResponsibilityTransferPanel.tsx
│  ├─ pages/
│  │  ├─ Dashboard.tsx
│  │  ├─ Inbox.tsx
│  │  ├─ Tasks.tsx
│  │  ├─ MentalLoad.tsx
│  │  └─ PitchMode.tsx                ← 黑客松专用幻灯
│  └─ lib/
│     ├─ types.ts                     ← 全部 TS 类型
│     ├─ mockData.ts                  ← 唐宁家的示例数据
│     ├─ mentalLoad.ts                ← 评分公式
│     ├─ utils.ts                     ← cn / formatPercent
│     ├─ agents/
│     │  ├─ taskCaptureAgent.ts
│     │  ├─ careWorkflowAgent.ts
│     │  └─ accountabilityAgent.ts
│     └─ llm/
│        └─ llmClient.ts              ← 明天接真实 LLM 的唯一入口
└─ docs/
   ├─ product-brief.md
   ├─ agent-architecture.md
   ├─ demo-script.md
   └─ tomorrow-todo.md
```

## 九、无 API Key 也能跑的部分

✅ AI 识别家庭消息（基于关键词 + 上下文窗口的本地确定性逻辑）
✅ 子任务展开（基于本地照护模板）
✅ "收到"模糊承接识别（正则 + 规则引擎）
✅ 心智负担打分（纯数学公式）
✅ 责任交接提示（基于风险类型生成）
✅ Pitch Mode 全屏幻灯

只要 `npm run dev`，整个 demo 都能跑。

## 十、明天接入真实 LLM 时

LLM 通道已经可用：

1. 在 `.env` 里填 `VITE_DEEPSEEK_API_KEY=`，直接调用 DeepSeek 官方 API 的 `deepseek-v4-flash`。
2. 或填 `VITE_OPENROUTER_API_KEY=`，通过 OpenRouter 调用 DeepSeek；若两个都填写，OpenRouter 优先。
3. 「问欧哈娜」中需明确开启 AI 补充回答，才会把当前问题与匹配记忆发送给模型。
4. 没有 key 或调用失败时，应用会继续使用本地确定性逻辑。

⚠️ **不要把 API Key 直接放进前端构建。** 生产环境请走后端代理。

## 十一、设计原则（建议背一下，评委会问）

1. **不责备家庭成员。** 系统说"责任未确认"，不说"你弟弟太懒"。
2. **不让唐宁更高效。** 我们减少她的协调负担，而不是给她又一个要维护的系统。
3. **让隐形劳动可见。** 用数字、用 before/after。
4. **让责任可交接。** 一旦有人正式承接，提醒和证明请求就转向他，而不是回到唐宁。
5. **AI 必须可解释。** 每条建议都有"为什么"。
6. **医疗动作必须人审。** AI 准备清单和提醒，最终下单 / 决策都在人手里。

---

明天接着写：见 `docs/tomorrow-todo.md`。
