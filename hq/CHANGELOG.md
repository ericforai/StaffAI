# HQ 系统变更记录

> 记录 The Agency HQ 的已交付能力、架构变化和暂缓事项。

## 2026-03-24 - StaffAI 平台硬化与任务工作区落地

### 已交付

- Web UI 新增任务、审批、执行历史三个工作区页面，主仪表盘可直接跳转并查看实时摘要。
- 后端新增任务、审批、执行、运行时与任务事件 API，并补齐 richer execution history 查询与字段投影。
- 执行持久化抽象拆分为 file / memory / postgres 三种模式，为非文件后端存储打通适配层。
- discussion pipeline 拆分为 orchestration、runtime、observability 等清晰边界，并补齐更完整的自动化测试。
- startup check 现在会展示真实执行器偏好、生效默认值与回退顺序，便于排查本地 CLI 执行路径。

### 设计变化

- HQ 从“讨论控制台”继续演进为“任务执行指挥台”，讨论、任务和审批工作流共享统一事件投影。
- 讨论执行从单一路径升级为带回退链路的运行时模型，并显式暴露 degraded / failed participant 状态。
- `server.ts` 进一步收敛为 composition root，路由、编排、运行时和持久化职责不再混在一个入口文件里。

### 修复与硬化

- 加强执行详情页、任务工作区和审批队列的空态、错误态、重试态展示，避免 smoke-only 覆盖。
- 讨论收集流程支持有限并发和 participant 级失败建模，不再 silent skip 专家失败。
- codex discussion runtime 复用 schema 文件，减少多次执行时的临时文件抖动。
- 运行时与 dashboard 事件映射从业务编排逻辑中拆出，降低 transport/domain mixing。

### 暂缓事项

- startup-check parity tests 仍作为后续补充项保留在根目录 `TODOS.md`。
- discussion failure-matrix 的扩展测试暂缓到下一轮覆盖。

---

## 2026-03-19 - HQ 多代理讨论控制台落地

### 已交付

- Web UI 主页面升级为三栏指挥台布局，讨论控制台不再缩在右下角。
- 讨论控制台支持专家搜索、选择、雇佣、任务分配、执行和综合结论展示。
- 支持把当前讨论阵容保存成模板，并一键复用到新的会话。
- 后端新增 Web 讨论 API：
  - `POST /api/discussions/search`
  - `POST /api/discussions/hire`
  - `POST /api/discussions/run`
- MCP 侧新增真实编排工具：
  - `find_experts`
  - `hire_experts`
  - `assign_expert_tasks`
  - `expert_discussion`
- 讨论执行层改为可切换的执行器模型，推荐优先使用本地 Claude Code / Codex CLI，降低对 OpenAI API 的强绑定。

### 设计变化

- 旧的“聊天面板 + 角落挂件”模式，升级为“人才池 + 组织状态 + 讨论执行”三块主域。
- 讨论模板从单纯的组织配置，扩展为可复用的讨论阵容。
- 讨论结果现在会保留每位专家的独立回复，以及主持人综合结论。

### 暂缓事项

下面这些想法已经记录，但本轮不强制实现：

- 讨论历史持久化和回放
- 模板重命名、删除和标签
- 专家失败时自动重试或替换
- 更细的阶段进度条
- 结果导出
- Web 鉴权、速率限制和输入校验

---

## 2026-03-18 - 基础重构

### 已交付

- 消除了前端/后端中一批类型和状态管理问题。
- 优化了 WebSocket 事件处理。
- 给知识库加了上限保护。
- 把常用常量从业务代码中提取出来。

### 说明

这一阶段主要是为 HQ 后续的多代理编排能力打基础。

