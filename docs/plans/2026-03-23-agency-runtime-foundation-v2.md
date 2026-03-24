# Agency Runtime Foundation v2

## Goal

把 `agency-agents` 从“有 agent 内容和若干转换脚本的仓库”升级为“有统一运行时、显式宿主适配、正式生成制品、可降级执行、可推荐下一步动作”的产品底座。

这次不做外部 gstack 对接，不把重点放在导入外部 skill 包，而是先把 Agency 自己的基础能力做扎实。

## Scope

本轮实现以下 8 个能力点：

1. Host 适配是显式设计，而不是 README 说明
2. 制品生成，而不是手写兼容文件
3. 统一本地状态目录
4. `setup` 作为正式入口
5. 客户端提示词 / 配置注入成为正式规范
6. 可执行 runtime 绑定，而不是纯 Markdown 人设
7. 发现与建议成为系统行为
8. 跨客户端退化兼容，而不是全或无

## Non-Goals

- 不接入 gstack runtime 或外部 skill 包
- 不做 discussion history/replay
- 不做 auth / rate limit / 多租户
- 不做完整 marketplace
- 不做所有 host 的完整安装器重写，只先覆盖当前最关键的宿主抽象与生成链路

## Current Baseline

现有项目已经有一些可复用的基础：

- 根目录 `scripts/convert.sh` / `scripts/install.sh` 已经具备多宿主转换与安装雏形
- HQ 后端已有 `discussion-service.ts`、`execution-strategy.ts`，可复用执行器与降级思想
- HQ 后端已有 `skill-scanner.ts` 雏形，可作为 capability discovery 起点
- HQ 已出现 `setup.sh`、`config/host-manifest.json`、`generated/` 的早期骨架

问题在于这些能力目前还是分散的：

- host 差异没有统一类型系统与适配层
- 生成物还没有统一 canonical source 和 manifest 驱动
- 状态目录还未进入 runtime 主路径
- capability/runtime/recommendation 没进入产品主流程

## Implementation Strategy

### Phase 1: Plan

产出正式设计，锁定边界与落点：

- 统一 canonical source：agent markdown 继续作为源，补一层 runtime manifest 生成
- 以 HQ 为核心 runtime：把宿主适配、状态目录、能力发现、推荐与降级都收进 HQ
- 保留现有 `scripts/convert.sh` / `install.sh`，但逐步让它们从“逻辑中心”退为“兼容入口”

### Phase 2: TDD

先补测试，再实现：

1. Host adapter tests
   - 给不同 host 的 capability/degrade/injection 规则做单测
2. Generated artifact tests
   - manifest 驱动生成 `README/snippet/registry`，确保生成稳定且不手写漂移
3. State dir tests
   - 验证默认状态目录、路径覆写、cache/session/log 目录初始化
4. Capability binding tests
   - 验证 agent 可以映射到 runtime capability 与 executor
5. Recommendation engine tests
   - 验证不同任务阶段返回对应推荐动作与推荐能力
6. Degradation tests
   - 验证 host 能力不足时退化到 advisory / serial / web-ui fallback

### Phase 3: Code Review

实现完成后进行两层检查：

- 自动验证：`npm test` / `npm run build` / `npm run lint`（可跑的部分都跑）
- 结构性 review：检查是否真正形成了单一事实源、显式适配层、可退化模型，避免继续散落在 README 和 shell 分支里

### Phase 4: Refactor-Clean

最后做一次清理：

- 合并重复常量与 host 分支逻辑
- 保证命名统一：host / capability / runtime / recommendation / degradation
- 删除已被新 runtime 取代的重复 glue 代码
- 把说明文档改成“引用生成物”而不是手写维护多份

## Detailed Workstreams

### 1. Host Adapter Layer

新增后端模块：

- `hq/backend/src/host-adapters.ts`
- `hq/backend/src/host-manifest.ts`

职责：

- 定义 `HostId`, `HostCapabilityLevel`, `HostAdapter`, `HostInjectionTarget`
- 从单一 manifest 读取宿主差异
- 统一暴露：
  - 路径
  - 支持的执行器
  - 支持的注入方式
  - 支持的能力
  - 降级策略

落点：

- 替代当前 scattered 的 host-specific 说明
- 为生成器、setup、API、前端提供统一数据来源

### 2. Artifact Generation Pipeline

新增或升级脚本：

- `hq/scripts/generate-runtime-artifacts.mjs`

生成物：

- `hq/generated/hosts/<host>/README.md`
- `hq/generated/hosts/<host>/snippet.*`
- `hq/generated/registry/hosts.json`
- `hq/generated/registry/capabilities.json`
- `hq/generated/registry/agents.json`
- `hq/generated/registry/recommendations.json`

设计原则：

- 源数据来自 canonical source + manifest
- 生成物只读，不手改
- README 只引用生成物，不复制业务逻辑

### 3. Unified State Directory

新增运行时目录规范：

- 默认：`~/.agency`
- 可覆写：`AGENCY_HOME`

目录结构：

- `~/.agency/config`
- `~/.agency/cache/hosts`
- `~/.agency/cache/discovery`
- `~/.agency/sessions`
- `~/.agency/logs`
- `~/.agency/generated`
- `~/.agency/executors`

新增模块：

- `hq/backend/src/runtime-paths.ts`
- `hq/backend/src/runtime-state.ts`

职责：

- 统一管理路径
- 初始化目录
- 读写 host capability cache / discovery snapshot / session metadata

### 4. Setup as Product Entry Point

升级：

- `hq/setup.sh`

目标：

- 发现本地 host
- 初始化状态目录
- 生成 runtime artifacts
- 生成或刷新 host injection snippets
- 输出 compatibility report

Setup 结果应该是：

- 用户运行一次 setup，就能知道：
  - 本机有哪些 host
  - Agency 对每个 host 的支持等级
  - 哪些能力是 full / partial / advisory
  - 该把哪段 snippet 注入到哪里

### 5. Client Injection Contract

新增正式约定层：

- manifest 中声明每个 host 的：
  - 目标文件
  - 注入策略
  - 优先级说明
  - fallback 行为

生成物示例：

- Claude: `CLAUDE-snippet.md`
- Codex: `AGENTS-snippet.md`
- Gemini: `GEMINI-snippet.md`
- Cursor: `cursor-rules-snippet.mdc`

并在 HQ API 中暴露：

- `GET /api/runtime/hosts`
- `GET /api/runtime/hosts/:id`
- `GET /api/runtime/hosts/:id/injection`

### 6. Runtime-Bound Capabilities

新增能力模型，不再只看 agent persona：

- `Capability`
- `BoundCapability`
- `ExecutorBinding`

新增模块：

- `hq/backend/src/capability-registry.ts`
- `hq/backend/src/capability-bindings.ts`

初始 capability 范围：

- `discussion.orchestrate`
- `discussion.consult`
- `host.inject`
- `agent.discover`
- `skill.discover`
- `executor.claude`
- `executor.codex`
- `executor.openai`
- `workflow.recommend`

后续 agent 可以通过 frontmatter 或映射规则绑定 capability，不要求现在就改所有 agent markdown。

### 7. Discovery + Recommendation as System Behavior

新增模块：

- `hq/backend/src/workflow-router.ts`
- `hq/backend/src/recommendation-engine.ts`

职责：

- 识别当前任务阶段：brainstorm / review / debug / ship / consult
- 基于 topic、executor 能力、host 能力和 active roster 给出推荐

新增 API：

- `POST /api/runtime/recommend`
- `GET /api/runtime/discovery`

前端新增展示：

- 当前 host 状态卡
- capability readiness
- recommended next actions
- degraded mode notice

### 8. Graceful Degradation Strategy

把现有 `execution-strategy.ts` 思路扩展为更广义的 runtime degradation：

- host 不支持完整注入 -> 返回 advisory snippet
- host 不支持 sampling -> 自动转 serial / consult fallback
- 本地 executor 缺失 -> 转 openai 或仅返回 manual steps
- capability 不可执行 -> 保留 persona/recommendation，不伪装为已执行

新增模块：

- `hq/backend/src/degradation-policy.ts`

并让以下路径统一依赖它：

- setup 输出
- runtime host API
- expert discussion API
- recommendation API

## Proposed File Changes

### New

- `hq/backend/src/host-adapters.ts`
- `hq/backend/src/host-manifest.ts`
- `hq/backend/src/runtime-paths.ts`
- `hq/backend/src/runtime-state.ts`
- `hq/backend/src/capability-registry.ts`
- `hq/backend/src/capability-bindings.ts`
- `hq/backend/src/workflow-router.ts`
- `hq/backend/src/recommendation-engine.ts`
- `hq/backend/src/degradation-policy.ts`
- `hq/backend/src/__tests__/host-adapters.test.ts`
- `hq/backend/src/__tests__/runtime-state.test.ts`
- `hq/backend/src/__tests__/capability-registry.test.ts`
- `hq/backend/src/__tests__/recommendation-engine.test.ts`
- `hq/backend/src/__tests__/degradation-policy.test.ts`
- `hq/scripts/generate-runtime-artifacts.mjs`
- `hq/generated/registry/*`

### Update

- `hq/config/host-manifest.json`
- `hq/setup.sh`
- `hq/start.sh`
- `hq/backend/src/types.ts`
- `hq/backend/src/server.ts`
- `hq/backend/src/web-server.ts`
- `hq/backend/src/discussion-service.ts`
- `hq/backend/src/execution-strategy.ts`
- `hq/backend/src/skill-scanner.ts`
- `hq/frontend/src/app/page.tsx`
- `hq/frontend/src/components/DiscussionControlPanel.tsx`
- `hq/frontend/src/hooks/*`（按需要补充 runtime/recommendation hooks）
- `hq/README.md`
- 根目录 `README.md`
- `integrations/README.md`

### Maybe Remove or Demote

- 让现有 `hq/scripts/generate-host-docs.mjs` 变成 `generate-runtime-artifacts.mjs` 的子集，避免双源维护

## TDD Order

建议严格按下面顺序实施：

1. `runtime-paths` + `runtime-state` tests
2. `host-manifest` + `host-adapters` tests
3. `degradation-policy` tests
4. `capability-registry` / `capability-bindings` tests
5. `recommendation-engine` tests
6. 生成器测试或 snapshot-like assertions
7. 实现 API 与 setup 脚本
8. 最后接前端展示

这样可以避免一开始就碰 UI，先把 runtime contract 稳住。

## Acceptance Criteria

完成后应满足：

1. 运行 `./hq/setup.sh` 会初始化 `~/.agency`、探测 host、生成 artifacts、输出兼容报告
2. HQ 后端能提供 host / capability / recommendation / degradation 相关 API
3. HQ 前端能展示：
   - 当前 host 概况
   - 可用能力
   - 推荐下一步动作
   - 已降级提示
4. 至少 Claude / Codex / Gemini 三个 host 有显式 manifest 与生成物
5. discussion executor 路径能统一走 degradation policy
6. 生成物来自单一 manifest，不再靠多份 README 手写同步
7. 测试覆盖新 runtime 基础模块
8. 旧的 convert/install 不被破坏，但其职责被下沉为兼容层

## Risks and Mitigations

### Risk 1: 变更面太大

缓解：

- 先落 runtime contract 与 tests，再接 UI
- 不重写所有旧脚本，只做“新中心 + 旧兼容”

### Risk 2: host 逻辑再次分散

缓解：

- 所有 host 差异必须先进入 manifest / adapter
- 禁止在 API / UI / setup 中直接硬编码 host 分支

### Risk 3: capability 过度设计

缓解：

- 第一版只做少量核心 capability
- 不追求完整 skill marketplace

### Risk 4: README 与生成物再次漂移

缓解：

- README 只描述流程，具体注入内容引用 generated artifacts

## Execution Decision

本轮开发按以下顺序推进：

1. 先做 runtime foundation，不做 gstack 接入
2. 先做 backend/runtime contract，再做 UI
3. 先做 TDD，再写实现
4. 完成后做 code-review 与 refactor-clean，再统一更新文档
