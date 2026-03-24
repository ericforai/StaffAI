# Agency Agents - Gemini CLI 使用说明书

## 目录

- [安装配置](#安装配置)
- [使用方式](#使用方式)
- [可用技能列表](#可用技能列表)
- [使用示例](#使用示例)

---

## 安装配置

### 1. 生成集成文件

```bash
cd /Users/user/agency-agents
./scripts/convert.sh --tool gemini-cli
```

### 2. 安装扩展

```bash
./scripts/install.sh --tool gemini-cli
```

### 3. 验证安装

```bash
ls ~/.gemini/extensions/agency-agents/skills/
```

应该看到各个专家的技能目录。

---

## 使用方式

### 方式一：/skill 命令

```
/skill <技能ID>
```

### 方式二：自然语言

```
使用 <技能名> 技能帮我 <任务>
调用 <技能名> 来处理 <问题>
```

---

## 可用技能列表

### 工程类 (Engineering)

| 技能ID | 名称 | 功能 |
|--------|------|------|
| `frontend-developer` | 前端开发者 | React、Vue、UI组件 |
| `backend-architect` | 后端架构师 | API设计、微服务架构 |
| `security-engineer` | 安全工程师 | 安全审查、漏洞检测 |
| `data-engineer` | 数据工程师 | 数据库、数据处理 |
| `devops-automator` | DevOps专家 | CI/CD、部署自动化 |
| `code-reviewer` | 代码审查员 | 代码质量审查 |
| `tdd-guide` | TDD指南 | 测试驱动开发 |
| `software-architect` | 软件架构师 | 系统架构设计 |
| `incident-response-commander` | 事故响应指挥 | 故障处理、应急响应 |

### 设计类 (Design)

| 技能ID | 名称 | 功能 |
|--------|------|------|
| `ui-designer` | UI设计师 | 界面设计、视觉设计 |
| `ux-architect` | UX架构师 | 用户体验、交互设计 |
| `ux-researcher` | UX研究员 | 用户研究、可用性测试 |
| `visual-storyteller` | 视觉叙事师 | 品牌视觉、设计系统 |

### 产品类 (Product)

| 技能ID | 名称 | 功能 |
|--------|------|------|
| `product-strategist` | 产品策略师 | 产品规划、战略 |
| `product-manager` | 产品经理 | 需求分析、Roadmap |

### 营销类 (Marketing)

| 技能ID | 名称 | 功能 |
|--------|------|------|
| `content-creator` | 内容创作者 | 文案、内容营销 |
| `seo-specialist` | SEO专家 | 搜索引擎优化 |
| `social-media-strategist` | 社交媒体策略 | 社媒运营策略 |

---

## 使用示例

### 前端开发

```
/skill frontend-developer

帮我创建一个响应式商品列表组件，使用 React 和 Tailwind CSS
```

或自然语言：
```
使用 frontend-developer 技能帮我设计一个登录表单
```

---

### 后端架构

```
/skill backend-architect

设计一个电商订单系统的微服务架构
```

---

### 安全审查

```
/skill security-engineer

审查这段用户认证代码的安全漏洞：
[代码内容]
```

---

### 数据库设计

```
/skill data-engineer

设计一个社交应用的数据库表结构，包括用户、帖子、评论、点赞
```

---

### 代码审查

```
/skill code-reviewer

审查以下代码的质量、可维护性和性能：
[代码内容]
```

---

### UI 设计

```
/skill ui-designer

设计一个移动端电商首页的UI布局
```

---

### TDD 开发

```
/skill tdd-guide

使用测试驱动开发方式实现一个用户注册功能
```

---

## 技能组合使用

### 场景一：全栈开发

```
# 1. 先设计架构
/skill backend-architect
设计一个博客系统的API接口

# 2. 前端实现
/skill frontend-developer
基于上述API设计前端页面

# 3. 安全审查
/skill security-engineer
审查前后端的安全问题
```

---

### 场景二：产品设计

```
# 1. 产品规划
/skill product-strategist
规划一个社交阅读App的核心功能

# 2. UX设计
/skill ux-architect
设计App的用户流程和交互

# 3. UI实现
/skill ui-designer
设计具体的界面视觉
```

---

### 场景三：安全加固

```
# 1. 安全审查
/skill security-engineer
审查系统的安全漏洞

# 2. 修复实现
/skill backend-architect
修复发现的安全问题

# 3. 再次验证
/skill code-reviewer
审查修复后的代码
```

---

## 查看可用技能

```bash
# 列出所有已安装技能
ls ~/.gemini/extensions/agency-agents/skills/

# 查看特定技能详情
cat ~/.gemini/extensions/agency-agents/skills/frontend-developer/SKILL.md
```

---

## 重新生成技能

修改专家配置后，重新生成：

```bash
cd /Users/user/agency-agents
./scripts/convert.sh --tool gemini-cli
./scripts/install.sh --tool gemini-cli
```

---

## 技能ID命名规则

- 全小写
- 使用连字符分隔单词
- 与专家目录名对应

例如：
- `Frontend Developer` → `frontend-developer`
- `Incident Response Commander` → `incident-response-commander`
- `UI/UX Architect` → `ui-ux-architect`

---

## 快捷参考

| 需求 | 技能 |
|------|------|
| 前端开发 | `/skill frontend-developer` |
| 后端架构 | `/skill backend-architect` |
| 安全审查 | `/skill security-engineer` |
| 数据库 | `/skill data-engineer` |
| 代码审查 | `/skill code-reviewer` |
| TDD开发 | `/skill tdd-guide` |
| UI设计 | `/skill ui-designer` |
| 产品策略 | `/skill product-strategist` |
