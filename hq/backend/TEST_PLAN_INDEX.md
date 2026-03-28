# 测试计划文档索引

本目录包含人才市场与组织架构重构的完整测试计划。

---

## 📚 文档导航

### 1. [TEST_PLAN.md](./TEST_PLAN.md) ⭐ 完整测试计划
**用途**: 全面的测试规划文档

**包含内容**:
- 后端测试规划（4 个测试文件）
- 前端测试规划（3 个测试类型）
- 优先级排序（P0/P1/P2）
- Mock 策略详解
- 测试覆盖率目标
- 测试执行顺序
- 质量检查清单

**适合**: 需要全面了解测试计划时阅读

---

### 2. [TEST_PLAN_QUICKSTART.md](./TEST_PLAN_QUICKSTART.md) 🚀 快速实施指南
**用途**: 分步实施指南 + 代码模板

**包含内容**:
- TDD 红绿重构工作流
- 5 个步骤的详细指南
- 测试代码模板（后端/前端/E2E）
- 测试运行命令速查
- 常见问题解答

**适合**: 立即开始编写测试时使用

---

### 3. [TEST_PLAN_CHECKLIST.md](./TEST_PLAN_CHECKLIST.md) ✅ 进度跟踪表
**用途**: 测试实施进度跟踪

**包含内容**:
- 7 个测试模块的详细任务分解
- 每个测试用例的完成状态
- 覆盖率目标跟踪
- 时间估算表
- 阻塞问题记录

**适合**: 跟踪测试实施进度时使用

---

### 4. [TEST_PLAN_SUMMARY.md](./TEST_PLAN_SUMMARY.md) 📋 交付总结
**用途**: 测试计划总览和快速开始

**包含内容**:
- 已创建文件清单
- 测试文件结构
- 优先级实施路线图
- 总时间估算
- 快速开始指南
- 成功标准

**适合**: 第一次了解测试计划时阅读

---

### 5. [src/__tests__/test-utils/market-test-helpers.ts](./src/__tests__/test-utils/market-test-helpers.ts) 🛠️ 测试工具库
**用途**: 可复用的测试辅助函数

**包含内容**:
- 测试数据生成器
- 预设测试数据
- GitHub API Mock
- Express Mock 工具
- 文件系统测试辅助
- 异步测试辅助

**适合**: 编写测试时导入使用

---

## 🎯 快速导航

### 我想...

#### 立即开始编写测试
👉 阅读 [TEST_PLAN_QUICKSTART.md](./TEST_PLAN_QUICKSTART.md)（5 分钟）
👉 使用 [market-test-helpers.ts](./src/__tests__/test-utils/market-test-helpers.ts) 工具库

#### 全面了解测试计划
👉 阅读 [TEST_PLAN.md](./TEST_PLAN.md)（20 分钟）

#### 跟踪测试实施进度
👉 使用 [TEST_PLAN_CHECKLIST.md](./TEST_PLAN_CHECKLIST.md)

#### 查看测试文件结构
👉 阅读 [TEST_PLAN_SUMMARY.md](./TEST_PLAN_SUMMARY.md)

#### 使用测试工具库
👉 导入 [market-test-helpers.ts](./src/__tests__/test-utils/market-test-helpers.ts)

---

## 📊 测试模块概览

### P0 - 核心后端测试（必须完成）
1. **Candidate Repository** (6-8h) - 数据持久化层
2. **GitHub Search** (6-8h) - 外部 API 集成
3. **Candidate Evaluator** (9-12h) - 评分算法
4. **E2E Tests** (6-8h) - 端到端用户流程

### P1 - 高优先级测试
5. **API Routes** (6-8h) - API 端点集成
6. **Frontend Components** (9-12h) - React 组件

### P2 - 中优先级测试
7. **Hooks Tests** (3-4h) - 自定义 Hooks

**总计**: 53-72 小时

---

## 🚀 5 分钟快速开始

```bash
# 1. 创建测试目录
cd hq/backend
mkdir -p src/__tests__/market

# 2. 创建第一个测试文件
touch src/__tests__/market/candidate-repository.test.ts

# 3. 从 TEST_PLAN_QUICKSTART.md 复制第一个测试用例

# 4. 运行测试（预期失败 - 红色阶段）
npm run test -- src/__tests__/market/candidate-repository.test.ts
```

**详细步骤**: 参见 [TEST_PLAN_QUICKSTART.md](./TEST_PLAN_QUICKSTART.md)

---

## 📈 覆盖率目标

| 类型 | 目标 | 当前 |
|------|------|------|
| 语句覆盖 | 80%+ | __% |
| 分支覆盖 | 80%+ | __% |
| 函数覆盖 | 90%+ | __% |
| 行覆盖 | 80%+ | __% |

---

## ✅ 质量检查清单

### 测试编写后
- [ ] 所有公共函数有单元测试
- [ ] 所有 API 端点有集成测试
- [ ] 关键用户流程有 E2E 测试
- [ ] 边界条件已覆盖
- [ ] 错误路径已测试
- [ ] 外部依赖已 Mock
- [ ] 测试之间独立
- [ ] 断言具体且有意义
- [ ] 覆盖率达到 80%+

### 提交前
- [ ] 所有测试通过
- [ ] 无 `console.log` 残留
- [ ] 无硬编码密钥
- [ ] TypeScript 类型检查通过
- [ ] 代码符合编码规范

---

## 🔗 相关资源

### 项目文档
- `/CLAUDE.md` - 项目概览
- `/hq/backend/TEST_PLAN.md` - 完整测试计划
- `/hq/backend/tdd-workflow.md` - TDD 工作流

### 参考测试
- `src/__tests__/approvals.routes.test.ts` - API 路由测试
- `src/__tests__/persistence-file-repositories.test.ts` - Repository 测试
- `tests/e2e/tasks-workspace.spec.ts` - E2E 测试

### 工具文档
- [node:test](https://nodejs.org/api/test.html) - Node.js 内置测试框架
- [Playwright](https://playwright.dev/) - E2E 测试框架
- [Testing Library](https://testing-library.com/) - React 组件测试
- [nock](https://github.com/nock/nock) - HTTP Mock

---

## 📝 使用建议

### 第一次阅读
1. 先读 [TEST_PLAN_SUMMARY.md](./TEST_PLAN_SUMMARY.md) 了解全局
2. 再读 [TEST_PLAN_QUICKSTART.md](./TEST_PLAN_QUICKSTART.md) 学习如何开始
3. 参考 [TEST_PLAN_CHECKLIST.md](./TEST_PLAN_CHECKLIST.md) 跟踪进度

### 实施过程中
1. 使用 [market-test-helpers.ts](./src/__tests__/test-utils/market-test-helpers.ts) 提高效率
2. 遵循 TDD 红绿重构流程
3. 定期更新 [TEST_PLAN_CHECKLIST.md](./TEST_PLAN_CHECKLIST.md) 进度

### Code Review 前
1. 检查覆盖率是否达标
2. 运行所有测试确保通过
3. 使用质量检查清单自审

---

## 💡 提示

- **遵循 TDD**: 先写测试，看它失败，写代码让它通过，重构改进
- **保持简单**: 从简单测试开始，逐步增加复杂度
- **使用工具**: 充分利用 `market-test-helpers.ts` 提高效率
- **持续集成**: 每完成一个模块就提交，不要等到全部完成
- **寻求帮助**: 遇到阻塞时及时沟通

---

## 🎓 学习资源

### TDD 最佳实践
- Red-Green-Refactor 循环
- 测试金字塔（单元 > 集成 > E2E）
- AAA 模式（Arrange-Act-Assert）
- 测试独立性原则

### 测试覆盖策略
- 快乐路径（正常流程）
- 错误路径（异常情况）
- 边界条件（极限值）
- 并发场景（竞态条件）

---

**文档版本**: 1.0
**创建日期**: 2026-03-27
**最后更新**: 2026-03-27

---

> **记住**: 测试是代码质量的守护者。好的测试是最好的文档。立即开始，一步一步完成。
