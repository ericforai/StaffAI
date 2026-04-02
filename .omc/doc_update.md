# Agency Agents 系统进展总结

更新时间：2026-03-31

## 项目概述

Agency 是一个 AI Agent 专家系统，通过 HQ Web Dashboard 管理多领域 Agent 专家库。

## 架构里程碑

| 阶段 | 完成时间 | 内容 |
|------|---------|------|
| Phase 1-4 | 2026-03-25 | Workshop 双核桥接架构完成 |
| Phase 5 | 2026-03-22 | Tool Execution Layer 升级 |
| Phase 6 | 2026-03-24 | Governance and Observation Layer |
| Phase 7-10 | 2026-03-25 | Workflow Closures, Task Types, BullMQ, Test Coverage |

## 当前 Track

已完成：Finalize physical connectivity between TS Office and Python Workshop

进行中：V0.2 Feature Delivery & Teaming (Phase 1: Intent to Task Conversion)

## 技术架构

- HQ Backend: Express + WebSocket (端口 3333)
- HQ Frontend: Next.js (端口 3008)
- Workshop: Python FastAPI (端口 8000)
- MCP 集成支持 Claude Code/Cursor

## 下一步

1. 完成 Intent → Task 转换 API
2. 实现 Feature Delivery Squad 入职流程
3. 更新前端 Plan/Artifacts Tab