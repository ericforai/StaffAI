# Agency Agents 系统进展总结

> 更新时间：2026-03-31

---

## 项目概述

**Agency** 是一个 AI Agent 专家系统，包含多领域 Agent 专家库（工程、设计、营销等），通过 HQ Web Dashboard 进行管理和编排。

---

## 架构里程碑

| 阶段 | 完成时间 | 内容 |
|------|---------|------|
| Phase 1 | 2026-03-25 | Preparation & Handshake — Workshop 注册机制 |
| Phase 2 | 2026-03-25 | SSE Bridge & Streaming — SSE 代理和流式输出 |
| Phase 3 | 2026-03-25 | Task Orchestration Logic — 任务编排逻辑 |
| Phase 4 | 2026-03-25 | Verification & Cleanup — 验证与收尾 |
| Phase 5 | 2026-03-22 | Tool Execution Layer 升级 |
| Phase 6 | 2026-03-24 | Governance and Observation Layer |
| Phase 7 | 2026-03-25 | Workflow Closures (phased parallel execution) |
| Phase 8 | 2026-03-25 | MVP Task Types and Context Sources |
| Phase 9 | 2026-03-25 | Data Persistence Upgrade (BullMQ) |
| Phase 10 | 2026-03-25 | Expanded Test Coverage |

---

## 当前 Track

### ✅ 已完成
- **Track: Finalize physical connectivity between TS Office and Python Workshop**

### 🔄 进行中
- **Track: V0.2: Feature Delivery & Teaming**
  - Phase 1: Intent to Task Conversion (进行中)
  - Phase 2: Frontend Integration (待开始)
  - Phase 3: Workflow Orchestration (待开始)

---

## 最近提交记录 (最近20条)

```
5467272 chore(conductor): Mark track 'Finalize physical connectivity...' as complete
46dd2d3 conductor(plan): Mark track 'Finalize physical connectivity...' as complete
a991504 conductor(checkpoint): Checkpoint end of Phase 4: Verification & Cleanup
b057282 conductor(plan): Mark final verification tasks as complete
a52c6bb docs(workshop): Document dual-core bridge architecture
464d1d5 conductor(checkpoint): Checkpoint end of Phase 3: Task Orchestration Logic
226e957 conductor(plan): Mark persistence task as complete
5774ff3 feat(workshop): Ensure task results are persisted
4ca4a2f conductor(plan): Mark orchestration tasks as complete
44604cb feat(workshop): Implement dynamic task routing to workshops
d532a38 conductor(checkpoint): Checkpoint end of Phase 2: SSE Bridge & Streaming
8b8367a conductor(plan): Mark integration task as complete
31a7bb7 feat(workshop): Integrate deer-flow streaming
b4e24ef conductor(plan): Mark streaming tasks as complete
944386c feat(workshop): Implement SSE proxy for workshop streaming
5bb8127 conductor(checkpoint): Checkpoint end of Phase 1: Preparation & Handshake
5da703b conductor(plan): Mark task 'Implement Workshop registration' as complete
42a43ad feat(workshop): Implement workshop registration mechanism
33a35d4 conductor(plan): Mark task 'Write connection health-check tests' as complete
3c46d10 feat(workshop): Add connection health-check tests
```

---

## 技术架构

### 核心组件
- **HQ Backend** (`hq/backend/`) — Express + WebSocket 服务 (端口 3333)
- **HQ Frontend** (`hq/frontend/`) — Next.js Dashboard (端口 3008)
- **Workshop** (`workshop/`) — Python FastAPI 核心 (端口 8000)
- **Deer Flow** (`workshop/deer-flow/`) — 外部 Agent 框架

### 关键特性
- **双核桥接架构**: TypeScript Office ↔ Python Workshop
- **MCP 集成**: 支持 Claude Code/Cursor 通过 MCP 调用 Agent
- **智能路由**: 基于 Name/ID/Description 加权匹配
- **风险评估**: Task 执行前评估风险等级 (LOW/MEDIUM/HIGH)
- **实时通信**: WebSocket 推送 Dashboard 事件

---

## 启动命令

```bash
# 启动完整系统
cd hq && ./start.sh

# 分别启动
cd hq/backend && npm run start:web     # 端口 3333
cd hq/frontend && PORT=3008 npm run dev # 端口 3008

# Workshop
workshop/.venv/bin/python workshop/main.py  # 端口 8000
```

---

## 下一步计划

1. **V0.2 Feature Delivery & Teaming**
   - 完成 Intent → Task 转换的 API
   - 实现 Feature Delivery Squad 入职流程
   - 更新前端 Plan/Artifacts Tab

2. **持续优化**
   - 提升测试覆盖率至 80%+
   - 完善 error handling
   - 优化 WebSocket 重连机制
