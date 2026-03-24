# Agency Foundation Upgrade Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 先把 `agency-agents` 自己的工程底座做扎实，补齐 setup、build、generated docs、host-specific generation、统一状态目录和客户端注入约定，再考虑对接外部能力。

**Architecture:** 以 `hq/` 为核心，建立一套“单一事实源 -> 生成 host-specific 文档与配置片段 -> setup 落地 -> start 启动”的流程。第一阶段不扩张执行器种类，不做外部 skill 对接，优先把 Agency 自己做成一个可安装、可生成、可说明、可降级的产品。

**Tech Stack:** Bash, Node.js, JSON manifest, existing HQ backend/frontend scripts.

---

## 按优先级排序的改造清单

### P0：先把自己的产品底座搭起来

1. **`setup + build + generated docs` 流程**
   - 给 HQ 一个正式的 `setup.sh`
   - 统一做状态目录初始化、依赖检查、文档生成
   - 避免“README 说一套，实际落地另一套”

2. **host-specific generation**
   - 不再手写 Claude / Codex / Gemini 三套接入说明
   - 用一个 manifest 生成不同宿主的配置片段
   - 让“多客户端适配”成为正式产物，而不是口头约定

3. **统一状态目录**
   - 参考 `~/.gstack/`
   - 为 Agency 建立统一目录，如 `~/.agency-hq/`
   - 至少包含：`logs/`、`sessions/`、`generated/`、`host-configs/`

4. **客户端配置注入约定**
   - 明确 Claude / Codex / Gemini 各自要注入什么
   - 通过 generated docs 输出标准片段
   - 后续才能做自动安装和 compatibility report

### P1：把“像产品”这件事补全

5. **skill preamble / telemetry / session tracking 机制**
   - 先定义 Agency 自己的轻量版本
   - 用于记录 setup、生成、启动、宿主使用情况
   - 不急着做复杂遥测，先把本地状态和会话感做起来

6. **能力降级策略**
   - 不同 host 不同能力，先写成 manifest
   - 例如：
     - Claude：完整 MCP + project instructions
     - Codex：MCP + AGENTS 注入
     - Gemini：文档注入 + 手动配置提示

7. **“人格化 skill” 的表达方式**
   - 先不引入外部 skills
   - 先定义 Agency 自己未来的 capability 表达规范
   - 让后续每个能力既有执行语义，也有清晰的人设说明

### P2：下一阶段再做

8. **可执行 runtime 绑定**
   - 某些能力不只是 Markdown，需要真实 runtime
   - 这一点是第二阶段工程，不在这轮做深

9. **Skill / Capability Registry**
   - 等 P0 稳定后再正式引入
   - 先保证生成、状态、宿主注入三件事是标准化的

10. **外部能力对接（包括 gstack）**
   - 放到 Agency 自己底层稳了以后

## 本次开发范围

### Task 1: 建立单一事实源

**Files:**
- Create: `hq/config/host-manifest.json`

**Step 1: 定义支持的宿主**
- Claude
- Codex
- Gemini CLI

**Step 2: 定义每个宿主的差异**
- config file label
- instruction section title
- snippet target
- capability level
- degrade strategy

### Task 2: 建立 generated docs 流程

**Files:**
- Create: `hq/scripts/generate-host-docs.mjs`
- Create: `hq/generated/README.md`

**Step 1: 从 manifest 生成 host-specific docs**

输出目录：
- `hq/generated/claude/`
- `hq/generated/codex/`
- `hq/generated/gemini/`

**Step 2: 生成标准接入片段**

至少包含：
- 该宿主如何接入 Agency HQ
- 推荐注入的项目说明
- MCP 指向方式
- 能力降级说明

### Task 3: 建立 setup 流程和统一状态目录

**Files:**
- Create: `hq/setup.sh`

**Step 1: 初始化状态目录**
- `~/.agency-hq/`
- `~/.agency-hq/logs`
- `~/.agency-hq/sessions`
- `~/.agency-hq/generated`
- `~/.agency-hq/host-configs`

**Step 2: 检查必要依赖**
- Node / npm
- backend/frontend 依赖是否存在

**Step 3: 调用 generated docs**
- setup 时自动生成最新宿主片段

### Task 4: 把流程接入现有 HQ

**Files:**
- Modify: `hq/start.sh`
- Modify: `hq/README.md`

**Step 1: start 时感知统一状态目录**

**Step 2: README 增加 Foundation Workflow**
- setup
- generated docs
- state dir
- host snippets

## 验证标准

1. `./hq/setup.sh` 可运行
2. `hq/generated/` 下能生成三类宿主文档
3. `~/.agency-hq/` 状态目录被初始化
4. `hq/start.sh` 能继续正常启动
5. README 能说明新流程

## 后续建议

1. 下一步做 `capability manifest`
2. 再下一步做 `host compatibility report`
3. 最后再做 `external skill/runtime integration`
