# Agency Agents - Claude Code 使用说明书

## 目录

- [安装配置](#安装配置)
- [两种使用模式](#两种使用模式)
- [MCP 模式](#mcp-模式)
- [Agent 模式](#agent-模式)
- [使用示例](#使用示例)

---

## 安装配置

### 模式一：MCP 模式（推荐）

编辑 `~/.claude/settings.json`，在 `mcpServers` 中添加：

```json
{
  "mcpServers": {
    "the-agency-hq": {
      "command": "node",
      "args": ["/Users/user/agency-agents/hq/backend/dist/mcp-server.js"],
      "description": "Agency Agents 专家系统"
    }
  }
}
```

### 模式二：Agent 模式

直接复制 Agent 文件到 Claude Code 目录：

```bash
# 复制所有专家
cp -r /Users/user/agency-agents/engineering/*.md ~/.claude/agents/
cp -r /Users/user/agency-agents/design/*.md ~/.claude/agents/
# ... 其他类别

# 或使用安装脚本
cd /Users/user/agency-agents
./scripts/install.sh --tool claude-code
```

---

## 两种使用模式

| 模式 | 安装方式 | 调用方式 | 功能 |
|------|----------|----------|------|
| **MCP 模式** | 配置 settings.json | `@工具名` | 智能路由、多专家讨论、人事管理 |
| **Agent 模式** | 复制 .md 文件 | 自然语言激活 | 直接使用专家能力 |

**推荐**：两种模式同时配置，互补使用。

---

## MCP 模式

### 工具列表

| 工具 | 功能 | 调用方式 |
|------|------|----------|
| `consult_the_agency` | 智能路由专家 | `@consult_the_agency 任务` |
| `expert_discussion` | 多专家讨论 | `@expert_discussion 主题` |
| `manage_staff` | 招聘/解雇 | `@manage_staff action=hire agent_query=xxx` |
| `report_task_result` | 保存经验 | `@report_task_result ...` |
| `consult_<专家ID>` | 直接咨询 | `@consult_frontend_developer 任务` |

### 使用方式

```
@consult_the_agency 我需要构建一个 React 电商网站
@expert_discussion 如何设计一个安全的用户认证系统？
@consult_backend_architect 设计RESTful API接口
```

---

## Agent 模式

### 激活方式

使用自然语言直接激活：

```
激活 Frontend Developer 帮我构建一个组件
使用 Backend Architect 设计 API 结构
让 Security Engineer 审查这段代码
请 UI Designer 帮我设计这个页面
```

### 可用专家

```bash
# 查看已安装的专家
ls ~/.claude/agents/
```

**常用专家**：
- Frontend Developer - 前端开发
- Backend Architect - 后端架构
- Security Engineer - 安全工程
- UI Designer - UI 设计
- Data Engineer - 数据工程
- Code Reviewer - 代码审查
- TDD Guide - 测试驱动开发

---

## 使用示例

### 场景一：MCP 智能路由

```
@consult_the_agency 帮我设计一个用户认证系统
```

系统自动匹配最合适的专家（如 Security Engineer + Backend Architect）。

---

### 场景二：MCP 多专家讨论

```
@expert_discussion 电商平台秒杀活动如何处理高并发？
```

系统自动邀请相关专家（Backend Architect、SRE、Data Engineer）讨论。

---

### 场景三：Agent 直接激活

```
激活 Frontend Developer

帮我创建一个响应式商品列表组件，需要：
- 支持分页加载
- 图片懒加载
- 加入购物车动画
```

---

### 场景四：混合使用

```
# 1. 先用 MCP 讨论整体方案
@expert_discussion 如何设计一个现代化的 SaaS 平台？

# 2. 激活特定 Agent 深入实施
激活 Backend Architect

基于刚才的讨论，帮我设计用户管理模块的数据库表结构

# 3. 代码审查
让 Code Reviewer 审查这段代码
```

---

## MCP 模式详细用法

### consult_the_agency

```
@consult_the_agency <任务描述>
```

根据任务自动选择最合适的专家。

---

### expert_discussion

```
@expert_discussion <讨论主题>
```

自动匹配 2-4 位专家讨论，输出各方观点 + 综合结论。

---

### manage_staff

```
@manage_staff action=hire agent_query=frontend
@manage_staff action=fire agent_query=security
```

---

### consult_<专家ID>

```
@consult_frontend_developer 设计一个商品列表
@consult_security_engineer 审查登录接口
@consult_data_engineer 设计数据库表
```

---

## 快捷参考

### MCP 工具速查

| 需求 | 命令 |
|------|------|
| 找专家 | `@consult_the_agency 任务` |
| 多讨论 | `@expert_discussion 主题` |
| 指定专家 | `@consult_<专家ID> 任务` |
| 招专家 | `@manage_staff action=hire agent_query=xxx` |
| 存经验 | `@report_task_result ...` |

### Agent 激活关键词

| 关键词 | 示例 |
|--------|------|
| 激活 | `激活 Frontend Developer` |
| 使用 | `使用 Backend Architect` |
| 让 | `让 Security Engineer 审查` |
| 请 | `请 UI Designer 设计` |

---

## 故障排查

### MCP 工具不可用

```bash
# 检查配置
cat ~/.claude/settings.json | grep -A 5 "the-agency-hq"

# 重启 Claude Code 使配置生效
```

### Agent 找不到

```bash
# 检查文件是否存在
ls ~/.claude/agents/ | grep frontend

# 重新安装
cd /Users/user/agency-agents
./scripts/install.sh --tool claude-code
```
