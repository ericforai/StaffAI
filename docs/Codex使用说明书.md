# Agency Agents - Codex 使用说明书

## 目录

- [安装配置](#安装配置)
- [MCP 工具列表](#mcp-工具列表)
- [详细用法](#详细用法)
- [使用示例](#使用示例)

---

## 安装配置

### 1. 添加 MCP 服务器

```bash
codex mcp add the-agency-hq -- node /Users/user/agency-agents/hq/backend/dist/mcp-server.js
```

### 2. 验证安装

```bash
codex mcp list
```

应该看到 `the-agency-hq` 在列表中。

### 3. 卸载（如需要）

```bash
codex mcp remove the-agency-hq
```

---

## MCP 工具列表

| 工具 | 功能 | 参数 |
|------|------|------|
| `consult_the_agency` | 智能路由到最合适的专家 | `task` - 任务描述 |
| `expert_discussion` | 多专家讨论，自动匹配 2-4 位专家 | `topic` - 讨论主题 |
| `manage_staff` | 招聘/解雇专家 | `action` - hire/fire, `agent_query` - 专家名/关键字 |
| `report_task_result` | 保存经验到知识库 | `task`, `agent_id`, `result_summary` |
| `consult_<专家ID>` | 直接咨询特定专家 | `task` - 任务描述 |

---

## 详细用法

### 1. consult_the_agency - 智能专家匹配

**功能**：根据任务自动选择最合适的专家。

**使用方式**：
```
@consult_the_agency <任务描述>
```

**示例**：
```
@consult_the_agency 我需要构建一个 React 电商网站的商品列表组件
@consult_the_agency 如何设计高并发的订单系统？
@consult_the_agency 审查这段代码的安全性
```

---

### 2. expert_discussion - 多专家讨论 ⭐

**功能**：自动匹配 2-4 位相关专家进行讨论，各方观点汇总后形成综合结论。

**使用方式**：
```
@expert_discussion <讨论主题>
```

**示例**：
```
@expert_discussion 如何设计一个安全的 JWT 认证系统？
@expert_discussion 电商平台秒杀活动的高并发架构设计
@expert_discussion 如何提高移动应用的用户留存率？
```

**讨论输出结构**：
- 参与专家列表（自动匹配）
- 各位专家的观点
- 综合结论和行动建议

---

### 3. manage_staff - 人事管理

**功能**：招聘（激活）或解雇（停用）专家。

**使用方式**：
```
@manage_staff action=hire agent_query=<专家名或关键字>
@manage_staff action=fire agent_query=<专家名或关键字>
```

**示例**：
```
# 招聘前端开发专家
@manage_staff action=hire agent_query=frontend

# 解雇安全工程师
@manage_staff action=fire agent_query=security

# 招聘特定专家
@manage_staff action=hire agent_query=frontend-developer
```

---

### 4. report_task_result - 知识库存档

**功能**：将专家完成任务的经验保存到知识库，供后续参考。

**使用方式**：
```
@report_task_result task=<原始任务> agent_id=<专家ID> result_summary=<结果摘要>
```

**示例**：
```
@report_task_result task=React组件性能优化 agent_id=frontend-developer result_summary=使用React.memo和useMemo优化，减少30%重渲染
```

---

### 5. consult_<专家ID> - 直接咨询

**功能**：直接指定某个专家进行咨询。

**使用方式**：
```
@consult_<专家ID> <任务描述>
```

**常用专家ID**：
```
@consult_frontend_developer    前端开发
@consult_backend_architect     后端架构
@consult_security_engineer     安全工程
@consult_ui_designer           UI设计
@consult_data_engineer         数据工程
@consult_devops_automator      DevOps自动化
@consult_code_reviewer         代码审查
@consult_tdd_guide             TDD测试驱动开发
```

**示例**：
```
@consult_frontend_developer 设计一个响应式导航栏组件
@consult_backend_architect 设计RESTful用户管理API
@consult_security_engineer 审查这个登录接口的安全漏洞
```

---

## 使用示例

### 场景一：构建新功能

```
# 1. 先让多专家讨论整体方案
@expert_discussion 如何设计一个用户认证系统？

# 2. 具体实施时咨询对应专家
@consult_backend_architect 设计JWT认证的API接口

# 3. 完成后审查代码
@consult_security_reviewer 审查这段认证代码

# 4. 保存经验
@report_task_result task=用户认证系统 agent_id=backend-architect result_summary=使用JWT + Refresh Token模式，设置合理的过期时间
```

### 场景二：代码审查

```
# 单个专家审查
@consult_code_reviewer 审查这段代码的质量和性能

# 多维度审查（讨论形式）
@expert_discussion 这段代码有哪些安全问题和性能瓶颈？
```

### 场景三：架构设计

```
# 多专家讨论架构方案
@expert_discussion 电商平台的微服务架构如何设计？

# 深入某个领域
@consult_data_engineer 设计订单数据库表结构
@consult_sre 设计服务的监控和告警方案
```

---

## 快捷命令参考

```bash
# 管理 MCP 服务器
codex mcp list                           # 查看已安装的 MCP
codex mcp add the-agency-hq -- node ...  # 添加
codex mcp remove the-agency-hq           # 删除

# 查看可用专家
ls ~/.claude/agents/                     # Claude Code agents
```

---

## 专家分类速查

| 类别 | 专家ID | 名称 |
|------|--------|------|
| 前端 | `frontend-developer` | 前端开发者 |
| 后端 | `backend-architect` | 后端架构师 |
| 安全 | `security-engineer` | 安全工程师 |
| 数据 | `data-engineer` | 数据工程师 |
| DevOps | `devops-automator` | DevOps 自动化专家 |
| 测试 | `tdd-guide` | TDD 指南 |
| 审查 | `code-reviewer` | 代码审查员 |
| UI设计 | `ui-designer` | UI 设计师 |
| 产品 | `product-strategist` | 产品策略师 |
