# 团队协作 · How we work together

> 队伍：后台审计 · Backstage Audit
> 黑客松：第五夜 赛道

## 一、第一次拉代码（每个新队友都要做一次）

```bash
# 1. 克隆仓库（HTTPS 也行，建议 SSH）
git clone git@github.com:<your-org>/<your-repo>.git
cd <your-repo>/hackhaton   # 如果项目在子目录

# 2. 装依赖
npm install

# 3. 跑起来
npm run dev
# 浏览器打开 http://localhost:5173/
```

> **注意**：`node_modules` 不进仓库，每个人自己装。`.env` 不进仓库，自己写本地的。

## 二、每天的工作流

### 开工前
```bash
git checkout main
git pull origin main      # 把别人的改动拿下来
git checkout -b feat/我的功能名  # 创建自己的分支
```

### 写完一段功能
```bash
git status                # 看改了什么
git add <具体文件>         # 不要用 git add . 误传 .env
git commit -m "feat: 给收件箱加上 OCR 识别"
git push origin feat/我的功能名
```

### 合并回 main
1. 去 GitHub 网页上 **New Pull Request**
2. 让另一个队友 **Review + Approve**
3. 点 **Merge**
4. 本地切回 main：`git checkout main && git pull`

## 三、分工建议（黑客松 48h）

| 角色 | 主要负责 | 关键文件 |
| --- | --- | --- |
| **AI / 算法** | 把本地确定性 agent 升级到真实 LLM | `src/lib/agents/*.ts`, `src/lib/llm/llmClient.ts` |
| **前端 / 设计** | 视觉打磨、动效、Pitch Mode | `src/pages/*.tsx`, `src/components/*.tsx`, `tailwind.config.js` |
| **数据 / 故事** | mock 数据真实化、用真实家庭聊天测试 | `src/lib/mockData.ts`, 截图 + 录屏 |
| **路演 / 文档** | demo 脚本、README、PPT、答辩问题准备 | `docs/*.md`, README |

## 四、用 AI 编程助手（每个人都可以用）

我们的项目结构对 AI 友好：

- **Claude Code (CLI)**: `claude` 然后描述需求
- **Cursor**: 直接打开项目目录
- **VSCode + Copilot**: 同上
- **Windsurf**: 同上

让 AI 改代码时，记得提一句"用项目里已有的设计系统（看 `tailwind.config.js`），不要引入新的颜色"。

## 五、不要做的事 ⚠️

- ❌ 不要 `git add .` 一键全加 —— 容易把 `.env` 或 `node_modules` 错传
- ❌ 不要在 `main` 分支上直接改东西 —— 走 feature 分支 + PR
- ❌ 不要 `git push --force` —— 会覆盖别人的工作
- ❌ 不要把 API Key 提交到仓库 —— 只放在自己的 `.env`，仓库里只有 `.env.example`
- ❌ 不要随便重命名/移动文件 —— 会让 git diff 变得难审

## 六、出问题怎么办

| 症状 | 处理 |
| --- | --- |
| `npm run dev` 跑不起来 | 删 `node_modules` 和 `package-lock.json`，重新 `npm install` |
| Pull 时冲突 | 别慌，看 `<<<<<<<` 标记，选保留谁的，删冲突标记，再 commit |
| 误删了文件 | `git checkout HEAD <文件名>` |
| 把 commit 提交错分支了 | 群里喊一声，别 `git reset --hard` |
| AI 改坏了一堆文件 | `git stash` 暂存自己的，`git checkout .` 回到上次 commit |

## 七、Demo 当天

- 提前 1 小时所有人 pull 一次最新
- 用 **Vercel 生产 URL** 演示（避免本地 npm 跑挂）
- 准备一份录屏 backup —— 万一现场网卡了
- 演讲人专心讲，不要现场改代码
- Pitch Mode 用键盘 ← / → / 空格 / Esc 控制
