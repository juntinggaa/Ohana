# 明天 · TODO

> 今晚已经搭好了一个 **完整可跑的 demo**。明天起床后，按以下顺序补。
> 每一项后面括号是预估时间。

## 🔥 必做（demo 前一定做完）

- [ ] **接入真实 LLM（30 min）**
  - 在 `.env` 里填 `VITE_DEEPSEEK_API_KEY=...`（或 OpenAI / Claude / Kimi）
  - 修改 `src/lib/llm/llmClient.ts` 中的 `callRemote()`：解开注释、补 fetch
  - ⚠️ 注意 Vite 前端环境变量前缀必须是 `VITE_`
  - ⚠️ **不要把 Key 直接打包到前端**。推荐写一个 `api/llm.ts` Vercel Function 或本地 Express 中转

- [ ] **用真实家庭消息试一遍（20 min）**
  - 找一两个真实朋友的家庭群聊截图（脱敏）
  - 粘贴进收件箱，看 AI 识别能不能跑通
  - 不行就回退到本地确定性逻辑 —— 我们已经留好了 fallback

- [ ] **截图 / 录屏（20 min）**
  - Dashboard 全图（用于路演首屏）
  - Inbox AI 识别后的 4 张任务卡（用于"AI 工作"段）
  - Task Detail 弹窗，特别是承接按钮（用于核心创新段）
  - Mental Load before/after 对比（用于数据冲击段）
  - 截屏放 `docs/screenshots/`

- [ ] **跑一遍完整 demo 脚本（15 min × 3）**
  - 用 `docs/demo-script.md` 计时
  - 把 Pitch Mode 顺序背熟，每张幻灯不超过 30 秒
  - 第 3 遍把时间压到 2 分 30 秒

## 🟡 次必做

- [ ] **持久化（45 min）**
  - 当前所有承接 / 任务状态变更都只在内存
  - 加一个 `src/lib/store.ts`（zustand），同步到 localStorage
  - 重要：刷新页面之后状态保留，这样录屏可以分段

- [ ] **改一两段措辞（15 min）**
  - 把 ResponsibilityTransferPanel 里的"建议直接发送"加上"复制到家庭群"按钮（execCommand 即可）
  - 把 AI 解读改得更口语 —— 不要"系统检测到"，要"我注意到了"

- [ ] **手机响应式（30 min）**
  - 现在主体是桌面优化的
  - 至少让 Dashboard 和 Pitch Mode 在评委手机上能看
  - 加 `@media` 适配 / 把侧栏在移动端变成顶部 tab bar

## 🟢 可选（时间充裕再做）

- [ ] **OCR 上传**
  - 用浏览器 `Tesseract.js` 或后端调百度 OCR
  - 把"妈妈手机里的处方照片"也变成可识别的任务来源

- [ ] **微信群消息上传**
  - 不需要真接微信 —— 接受 `.txt` 导出文件即可
  - 增加 Inbox 页一个"上传聊天记录文件"按钮

- [ ] **AI 生成周报**
  - 在 Mental Load 页底加一个"AI 总结本周"
  - "本周唐宁发起了 14 件事、追问了 18 次。3 件成功转给弟弟。"

- [ ] **更动人的 Pitch Mode 收尾**
  - 加一张 SLIDE 9：唐宁的睡眠记录从碎片→连续
  - 或一张"明天，她可以不必在凌晨 1:37 突然坐起来"

- [ ] **接入 DeepSeek 模型自带的工具调用**
  - DeepSeek 支持 function calling，让 Agent 1 真的输出结构化 JSON
  - 这一段在评委追问"是不是真 AI"时是杀手锏

## 🛡 安全 / 合规要做的事（赛后）

- [ ] 家庭消息端到端加密
- [ ] LLM 调用走后端代理，前端不携带 Key
- [ ] 用户能一键导出 + 删除所有数据
- [ ] 关于"医疗建议"部分，加显著免责声明
- [ ] 老人画像数据脱敏

## 📞 评委可能挑战的预演

参考 `docs/demo-script.md` 末尾的 Q&A 模拟。
建议明天演完一遍后让队友扮演挑剔评委，至少演 2 轮。

---

写于今晚搭完 MVP 时。
你睡了，我替你把这个文件留下来。
明天起来，先跑 `npm run dev`，确认还能跑，然后从最上面那一项开始。
