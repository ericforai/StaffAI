# 如何激活 Agency Agents

## Codex (推荐)

### 单个专家咨询

```
@consult_the_agency 我需要构建一个电商网站
@consult_frontend_developer 设计商品列表组件
@consult_backend_architect 设计 RESTful API
@consult_security_reviewer 审查这段代码
```

### 多专家讨论 ⭐

系统自动匹配相关专家进行讨论：

```
@expert_discussion 如何设计一个安全的用户认证系统？
@expert_discussion 电商平台的高并发架构如何设计？
@expert_discussion 如何提高网站的用户留存率？
```

**示例输出**：自动邀请 2-4 位专家，每位从专业角度给出观点，最后形成综合结论

**管理 MCP 服务器：**
```bash
# 查看已添加的 MCP 服务器
codex mcp list

# 添加（如果未添加）
codex mcp add the-agency-hq -- node /Users/user/agency-agents/hq/backend/dist/mcp-server.js

# 删除
codex mcp remove the-agency-hq
```

---

## Claude Code (claude)

**方式一：直接引用**
```
激活 Frontend Developer 帮我构建一个 React 组件
使用 Backend Architect 设计 API 结构
让 Code Reviewer 审查这段代码
```

**方式二：MCP 工具**
```
@consult_the_agency 我需要构建一个电商网站
@consult_frontend_developer 设计商品列表组件
```

---

## Gemini CLI (gemini)

```
/skill frontend-developer
/skill backend-architect
/skill security-reviewer
```

**或自然语言：**
```
使用 frontend-developer 技能帮我构建 UI
```

---

## Cursor (cursor)

无需显式激活，Cursor 自动读取 `.cursor/rules/`：

```
帮我构建一个 React 表单组件
设计 RESTful API 接口
审查这段代码的安全性
```

---

## 快捷查询

```bash
# Codex MCP 服务器
codex mcp list

# Claude Code agents
ls ~/.claude/agents/

# Gemini CLI skills
ls ~/.gemini/extensions/universal-skills/
```

---

## 常用 Agent 激活对照表

| 场景 | Codex MCP | Claude Code | Gemini CLI |
|------|-----------|-------------|------------|
| 前端 | `@consult_frontend_developer` | `激活 Frontend Developer` | `/skill frontend-developer` |
| 后端 | `@consult_backend_architect` | `使用 Backend Architect` | `/skill backend-architect` |
| 审查 | `@consult_code_reviewer` | `让 Code Reviewer 审查` | `/skill code-reviewer` |
| 安全 | `@consult_security_engineer` | `激活 Security Engineer` | `/skill security-engineer` |
| 测试 | `@consult_tdd_guide` | `使用 TDD Guide` | `/skill tdd-guide` |
