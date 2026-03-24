# The Agency HQ

> AI 专家特遣队指挥中心 | Intelligent Agent Command Center

The Agency HQ 是一个面向 AI 专家小队的指挥台。它现在有两条主要使用路径：

1. Web UI 里的多代理讨论控制台，适合直接操作、编组、执行和复用专家阵容。
2. MCP 工具链，适合在 Codex / Cursor 等客户端里调用同一套专家能力。

## 现在可直接用的能力

- 多代理讨论控制台已经集成到 Web 页面主视图中，不再只是角落里的聊天挂件。
- 可以在页面里完成专家搜索、挑选、雇佣、任务分配、执行和结论汇总。
- 支持把当前专家阵容保存成模板，并一键复用到新的讨论会话。
- 讨论执行层支持本地 CLI 执行器路线，推荐优先使用 Claude Code / Codex CLI，避免把讨论能力强绑定在 OpenAI API 上。

## 快速开始

### 1. 初始化 HQ 基础设施

```bash
cd hq && ./setup.sh
```

`setup.sh` 会完成四件事：

- 初始化统一状态目录 `~/.agency/`（或 `AGENCY_HOME`）
- 检查并安装 backend / frontend 依赖
- 生成 runtime artifacts 到 `hq/generated/`
- 输出 host 兼容报告与注入入口

### 2. 启动 HQ

```bash
cd hq && ./start.sh
```

### 3. 查看生成的宿主接入片段

```bash
cat hq/generated/hosts/claude/README.md
cat hq/generated/hosts/codex/README.md
cat hq/generated/hosts/gemini/README.md
cat hq/generated/registry/hosts.json
```

默认访问：

- 前端: `http://localhost:3008`
- 后端: `http://localhost:3333`

## 主要功能

### Web 端多代理讨论控制台

页面里可以直接完成以下流程：

- 搜索适合当前主题的专家
- 勾选参与者
- 雇佣未在职但匹配的专家
- 分配每位专家的独立任务
- 运行讨论并查看各自回复
- 查看主持人综合结论
- 保存讨论小队模板并一键复用

### Web 讨论 API

后端提供两类接口：

讨论接口：
- `POST /api/discussions/search`
- `POST /api/discussions/hire`
- `POST /api/discussions/run`
- `GET /api/startup-check`
- `GET /startup-check`

runtime foundation 接口：
- `GET /api/runtime/hosts`
- `GET /api/runtime/hosts/:id`
- `GET /api/runtime/hosts/:id/injection`
- `GET /api/runtime/discovery`
- `POST /api/runtime/recommend`

其中 `/startup-check` 是一个面向人工检查的启动页，会直接展示默认执行器、实际生效执行器、CLI 就绪状态以及 OpenAI 回退是否开启。

### MCP 工具

当前可用的 MCP 工具包括：

- `consult_the_agency`
- `manage_staff`
- `report_task_result`
- `find_experts`
- `hire_experts`
- `assign_expert_tasks`
- `expert_discussion`

### 讨论执行器

建议把讨论执行器理解为一个可切换层，而不是固定绑定某个云端 API。

- 推荐优先使用本地 Claude Code / Codex CLI
- 可配置回退到 OpenAI API
- 这样可以把大部分讨论流量留在本地执行路径里，节省调用成本

常用环境变量：

- `AGENCY_DISCUSSION_EXECUTOR=auto|claude|codex|openai`
- `AGENCY_DISCUSSION_CLAUDE_PATH=/absolute/path/to/claude`
- `AGENCY_DISCUSSION_CODEX_PATH=/absolute/path/to/codex`
- `AGENCY_DISCUSSION_TIMEOUT_MS=240000`
- `AGENCY_MCP_SAMPLING_POLICY=client|force_on|force_off`
- 只有启用 API 回退时才需要 `OPENAI_API_KEY`

`AGENCY_MCP_SAMPLING_POLICY` 用于控制网关对 sampling 能力的声明策略：

- `client`：跟随 MCP 客户端（Codex / Claude Code）声明能力（默认）
- `force_on`：网关强制开启 sampling（允许并行采样路径）
- `force_off`：网关强制关闭 sampling（统一走串行/降级路径）

示例：

```bash
export AGENCY_MCP_SAMPLING_POLICY=client
./hq/start.sh
```

## 项目结构

```text
hq/
├── config/
│   └── host-manifest.json            # 宿主差异、注入策略、能力等级
├── generated/
│   ├── hosts/                        # host-specific README / snippet
│   └── registry/                     # hosts / capabilities / agents / recommendations
├── scripts/
│   └── generate-runtime-artifacts.mjs
├── setup.sh                          # 初始化 ~/.agency + 生成 artifacts + 兼容报告
├── start.sh                          # 启动前后端
├── backend/
│   └── src/
│       ├── host-adapters.ts          # 显式 host adapter 层
│       ├── runtime-state.ts          # 统一状态目录与 snapshot 读写
│       ├── capability-registry.ts    # runtime capability registry
│       ├── recommendation-engine.ts  # stage detection + next action recommendation
│       ├── degradation-policy.ts     # graceful degradation
│       ├── server.ts                 # Express + runtime/discussion API
│       └── ...
└── frontend/
    └── src/
        ├── app/page.tsx              # 三栏指挥台布局
        ├── components/DiscussionControlPanel.tsx
        ├── hooks/useRuntimeFoundation.ts
        └── ...
```

## Foundation Workflow

HQ 现在采用一套更明确的 runtime foundation 流程：

1. **Manifest 作为单一事实源**
   - `hq/config/host-manifest.json`
2. **生成 runtime artifacts**
   - `node hq/scripts/generate-runtime-artifacts.mjs`
3. **统一状态目录**
   - 默认 `~/.agency/`
   - 可通过 `AGENCY_HOME` 覆写
4. **setup 负责初始化与兼容报告**
   - `./hq/setup.sh`
5. **start 负责启动并复用 artifacts**
   - `./hq/start.sh`
6. **HQ 页面直接展示 host/capability/recommendation/degraded 状态**
   - 作为日常操作面的第一视图

这一版已经把 host adapter、artifact generation、统一状态目录、runtime recommendation、graceful degradation 收进正式产品路径里。

## MCP 配置示例

```json
{
  "command": "node",
  "args": ["/path/to/agency-agents/hq/backend/dist/mcp-server.js"]
}
```

如需显式设置 sampling 策略，可在 MCP 启动命令中注入环境变量：

```json
{
  "command": "bash",
  "args": [
    "-lc",
    "AGENCY_MCP_SAMPLING_POLICY=client node /path/to/agency-agents/hq/backend/dist/mcp-server.js"
  ]
}
```

## TODO / Roadmap

下面这些想法先记录下来，当前不作为本轮必须完成项：

- 讨论历史持久化和会话回放
- 模板重命名、删除和标签管理
- 专家执行失败时的自动重试或替换机制
- 更完整的讨论进度条和阶段视图
- 讨论结果导出为文档或任务卡
- Web 端鉴权、速率限制和输入校验
