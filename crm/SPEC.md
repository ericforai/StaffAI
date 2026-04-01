# CRM 系统规格说明书

## 1. 概述与目标

为 agency-agents 项目构建一个模块化 CRM 系统，支持联系人、公司、交易、任务管理，遵循 agency-agents 的架构模式（Repository 模式、Express 后端 + Next.js 前端分离）。

## 2. 技术选型

- **后端**: Node.js + Express + TypeScript（复用 agency-agents/hq 模式）
- **前端**: Next.js + React + TypeScript
- **数据库**: 文件存储（JSON Repository Seam，与 hq/backend 保持一致）
- **端口**: 前端 3010，后端 3344

## 3. 功能模块

### 3.1 联系人管理（Contacts）
- 增删改查联系人
- 字段：id, name, email, phone, companyId, tags, createdAt

### 3.2 公司管理（Companies）
- 增删改查公司
- 字段：id, name, industry, website, address, contacts[]

### 3.3 交易管理（Deals）
- 增删改查交易
- 字段：id, title, companyId, contactId, amount, stage, probability, closeDate

### 3.4 任务管理（Tasks）
- 增删改查任务
- 字段：id, title, description, relatedType, relatedId, dueDate, status, priority

## 4. API 接口设计

```
GET    /api/crm/contacts          - 列表
POST   /api/crm/contacts           - 创建
GET    /api/crm/contacts/:id       - 详情
PUT    /api/crm/contacts/:id       - 更新
DELETE /api/crm/contacts/:id       - 删除

GET    /api/crm/companies          - 列表
POST   /api/crm/companies          - 创建
GET    /api/crm/companies/:id      - 详情
PUT    /api/crm/companies/:id      - 更新
DELETE /api/crm/companies/:id      - 删除

GET    /api/crm/deals              - 列表
POST   /api/crm/deals              - 创建
GET    /api/crm/deals/:id          - 详情
PUT    /api/crm/deals/:id          - 更新
DELETE /api/crm/deals/:id          - 删除

GET    /api/crm/tasks              - 列表
POST   /api/crm/tasks              - 创建
GET    /api/crm/tasks/:id          - 详情
PUT    /api/crm/tasks/:id          - 更新
DELETE /api/crm/tasks/:id          - 删除
```

## 5. 前端页面结构

```
/crm                      - 首页仪表盘
/crm/contacts             - 联系人列表
/crm/contacts/[id]       - 联系人详情
/crm/companies            - 公司列表
/crm/companies/[id]       - 公司详情
/crm/deals                - 交易管道
/crm/tasks                - 任务看板
```

## 6. 架构原则

- Repository 模式（接口与实现分离）
- 不可变性（Immutable updates）
- 统一 API 响应格式 { success, data, error }
- TypeScript 严格模式（无 any）
