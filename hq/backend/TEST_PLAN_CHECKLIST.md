# 测试实施进度跟踪表

## 使用说明
- [ ] 未开始
- [x] 已完成
- [~] 进行中

---

## P0 - 核心后端测试（必须完成）

### 1. Candidate Repository 测试
**文件**: `src/__tests__/market/candidate-repository.test.ts`
**预计时间**: 2-3 小时

- [ ] 1.1 CRUD 基础操作
  - [ ] saveCandidate 生成 ID
  - [ ] saveCandidate 防止重复 URL
  - [ ] getCandidate 按 ID 获取
  - [ ] listCandidates 返回所有
  - [ ] listCandidates 按 source 筛选
  - [ ] listCandidates 按 capability 筛选
  - [ ] updateCandidate 更新字段
  - [ ] deleteCandidate 删除记录

- [ ] 1.2 导入状态管理
  - [ ] markAsImported 设置导入状态
  - [ ] listUnimported 只返回未导入
  - [ ] listImported 只返回已导入
  - [ ] 防止重复导入

- [ ] 1.3 持久化层测试
  - [ ] FileCandidateRepository 持久化到 JSON
  - [ ] FileCandidateRepository 从 JSON 加载
  - [ ] FileCandidateRepository 处理文件系统错误
  - [ ] InMemoryCandidateRepository 内存存储
  - [ ] InMemoryCandidateRepository 实例隔离

- [ ] 1.4 边界条件
  - [ ] 缺失必填字段
  - [ ] 不存在的 ID 返回 null
  - [ ] 空池返回空数组
  - [ ] 并发更新处理

**状态**: [ ] 未开始 | [~] 进行中 | [x] 已完成
**覆盖率**: ___/___ %

---

### 2. GitHub Search 测试
**文件**: `src/__tests__/market/github-search.test.ts`
**预计时间**: 2-3 小时

- [ ] 2.1 成功场景
  - [ ] 返回格式化的候选列表
  - [ ] 正确处理分页
  - [ ] 尊重查询参数（language, stars, forks）
  - [ ] 按 URL 去重

- [ ] 2.2 错误处理
  - [ ] 认证失败返回空数组
  - [ ] 优雅处理限流
  - [ ] 网络错误处理
  - [ ] 缺失 GITHUB_TOKEN 环境变量

- [ ] 2.3 边界条件
  - [ ] 无结果返回空数组
  - [ ] 格式错误的 API 响应
  - [ ] 超时处理
  - [ ] 限制 maxResults 参数

**状态**: [ ] 未开始 | [~] 进行中 | [x] 已完成
**覆盖率**: ___/___ %

---

### 3. Candidate Evaluator 测试
**文件**: `src/__tests__/market/candidate-evaluator.test.ts`
**预计时间**: 3-4 小时

- [ ] 3.1 评分算法
  - [ ] 计算总分数（所有因素）
  - [ ] stars 权重（0-30 分）
  - [ ] recent commits 权重（0-25 分）
  - [ ] contributors 权重（0-20 分）
  - [ ] README 质量 权重（0-15 分）
  - [ ] license 权重（0-10 分）
  - [ ] 分数映射到 tier
  - [ ] 分数映射到 rating

- [ ] 3.2 能力识别
  - [ ] 从 topics 检测 engineering
  - [ ] 从 topics 检测 design
  - [ ] 从 topics 检测 marketing
  - [ ] 从 description 提取 specialties
  - [ ] 缺失 README 优雅处理
  - [ ] 缺失 topics 优雅处理

- [ ] 3.3 README 质量评估
  - [ ] 完整 README 返回满分
  - [ ] 缺失章节扣分
  - [ ] 空 README 处理
  - [ ] 非 markdown README 处理

- [ ] 3.4 边界条件
  - [ ] 零 stars 处理
  - [ ] 零 commits 处理
  - [ ] 零 contributors 处理
  - [ ] 无 license 处理
  - [ ] 分数上限 100

**状态**: [ ] 未开始 | [~] 进行中 | [x] 已完成
**覆盖率**: ___/___ %

---

### 4. E2E 测试（前端）
**文件**: `tests/e2e/talent-market.spec.ts`
**预计时间**: 2-3 小时

- [ ] 4.1 完整搜索流程
  - [ ] 用户在 GitHub 搜索候选
  - [ ] 搜索结果正确显示
  - [ ] 用户按 source 筛选结果
  - [ ] 用户按 score 排序结果

- [ ] 4.2 完整导入流程
  - [ ] 用户查看候选详情
  - [ ] 用户导入候选为 agent
  - [ ] 导入的候选出现在组织页面
  - [ ] 导入的候选在市场标记为已导入

- [ ] 4.3 错误场景
  - [ ] 搜索失败显示错误消息
  - [ ] 导入失败显示错误消息
  - [ ] 用户可以重试失败操作

- [ ] 4.4 空状态
  - [ ] 无候选时显示空状态
  - [ ] 搜索无结果时显示空状态
  - [ ] 空状态显示有帮助的消息

- [ ] 4.5 导航流程
  - [ ] 从仪表盘到人才市场
  - [ ] 从人才市场到组织
  - [ ] 浏览器后退按钮正常工作

**状态**: [ ] 未开始 | [~] 进行中 | [x] 已完成
**通过率**: ___/___ %

---

## P1 - 高优先级测试

### 5. API Routes 集成测试
**文件**: `src/__tests__/integration/market-routes.test.ts`
**预计时间**: 2-3 小时

- [ ] 5.1 搜索端点
  - [ ] POST /api/market/search 返回候选
  - [ ] 验证必填的 query 参数
  - [ ] 验证 maxResults 限制 (1-100)
  - [ ] 缺失 token 返回 501
  - [ ] 服务错误优雅处理

- [ ] 5.2 评估端点
  - [ ] POST /api/market/evaluate 返回评估分数
  - [ ] 识别能力
  - [ ] 验证候选 ID 参数
  - [ ] 不存在的 ID 返回 404

- [ ] 5.3 列表端点
  - [ ] GET /api/market/candidates 返回所有
  - [ ] 按 source 筛选
  - [ ] 按导入状态筛选
  - [ ] 支持分页

- [ ] 5.4 详情端点
  - [ ] GET /api/market/candidates/:id 返回详情
  - [ ] 不存在的 ID 返回 404

- [ ] 5.5 导入端点
  - [ ] POST /api/market/candidates/:id/import 创建 agent
  - [ ] 验证未导入过
  - [ ] Agent 服务不可用返回 501
  - [ ] 映射能力到 agent 角色

- [ ] 5.6 删除端点
  - [ ] DELETE /api/market/candidates/:id 删除候选
  - [ ] 不存在的 ID 返回 404

**状态**: [ ] 未开始 | [~] 进行中 | [x] 已完成
**覆盖率**: ___/___ %

---

### 6. 前端组件测试
**文件**: `src/components/__tests__/TalentMarket.test.tsx`
**预计时间**: 3-4 小时

- [ ] 6.1 搜索功能
  - [ ] 验证 query 输入必填
  - [ ] 验证 maxResults 范围 (1-100)
  - [ ] 搜索按钮触发 API 调用
  - [ ] 显示候选卡片
  - [ ] 无结果时显示空状态
  - [ ] API 失败显示错误状态
  - [ ] 获取时显示加载状态

- [ ] 6.2 候选卡片
  - [ ] 显示仓库名和描述
  - [ ] 显示评估分数和评级
  - [ ] 显示能力标签
  - [ ] 显示来源图标（GitHub/npm）
  - [ ] 未导入显示导入按钮
  - [ ] 已导入显示已导入徽章
  - [ ] 链接到仓库 URL

- [ ] 6.3 筛选和排序
  - [ ] 按 source 筛选
  - [ ] 按导入状态筛选
  - [ ] 按分数排序（降序）
  - [ ] 按 stars 排序（降序）
  - [ ] 按更新日期排序（降序）
  - [ ] 组合筛选正确工作

- [ ] 6.4 导入功能
  - [ ] 导入按钮打开确认对话框
  - [ ] 导入确认显示候选摘要
  - [ ] 确认时调用导入 API
  - [ ] 取消时关闭对话框
  - [ ] 导入成功显示 toast
  - [ ] 导入失败显示错误
  - [ ] 已导入候选禁用按钮

- [ ] 6.5 分页
  - [ ] 显示正确页数
  - [ ] 分页导航切换页
  - [ ] 分页遵守页大小限制

**状态**: [ ] 未开始 | [~] 进行中 | [x] 已完成
**覆盖率**: ___/___ %

---

## P2 - 中优先级测试

### 7. Hooks 测试
**文件**: `src/hooks/__tests__/useTalentMarket.test.ts`
**预计时间**: 1-2 小时

- [ ] 7.1 数据获取
  - [ ] 挂载时获取候选
  - [ ] 处理加载状态
  - [ ] 处理错误状态
  - [ ] refetch 回调重新获取

- [ ] 7.2 搜索操作
  - [ ] searchCandidates 调用搜索 API
  - [ ] searchCandidates 更新候选列表
  - [ ] searchCandidates 处理错误

- [ ] 7.3 导入操作
  - [ ] importCandidate 调用导入 API
  - [ ] importCandidate 更新导入状态
  - [ ] importCandidate 处理错误

**状态**: [ ] 未开始 | [~] 进行中 | [x] 已完成
**覆盖率**: ___/___ %

---

## 总体进度

### 测试文件完成度
- [ ] Candidate Repository 测试（P0）
- [ ] GitHub Search 测试（P0）
- [ ] Candidate Evaluator 测试（P0）
- [ ] API Routes 测试（P1）
- [ ] 前端组件测试（P1）
- [ ] Hooks 测试（P2）
- [ ] E2E 测试（P0）

### 覆盖率目标
| 类型 | 当前 | 目标 | 状态 |
|------|------|------|------|
| 语句覆盖 | __% | 80%+ | [ ] |
| 分支覆盖 | __% | 80%+ | [ ] |
| 函数覆盖 | __% | 90%+ | [ ] |
| 行覆盖 | __% | 80%+ | [ ] |

### 测试通过率
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] 所有 E2E 测试通过

---

## 阻塞问题

### 当前阻塞
- [ ] 无阻塞

### 已解决的问题
1. [问题描述] - 解决日期

### 需要讨论的问题
1. [问题描述]

---

## 时间估算

| 任务 | 预计时间 | 实际时间 | 差异 |
|------|---------|---------|------|
| Candidate Repository 测试 | 2-3h | ___h | ___h |
| GitHub Search 测试 | 2-3h | ___h | ___h |
| Candidate Evaluator 测试 | 3-4h | ___h | ___h |
| API Routes 测试 | 2-3h | ___h | ___h |
| 前端组件测试 | 3-4h | ___h | ___h |
| Hooks 测试 | 1-2h | ___h | ___h |
| E2E 测试 | 2-3h | ___h | ___h |
| **总计** | **15-22h** | ___h | ___h |

---

## 下一步行动

### 本周目标
- [ ] 完成 P0 测试（Repository, Search, Evaluator）
- [ ] 达到 80% 覆盖率
- [ ] 所有测试通过

### 下周目标
- [ ] 完成 P1 测试（API Routes, 组件）
- [ ] 完成 P2 测试（Hooks）
- [ ] E2E 测试全部通过

---

## 备注

### 测试策略
- 遵循 TDD 红绿重构流程
- 使用 Mock 隔离外部依赖
- 确保测试独立性
- 保持测试可读性和可维护性

### 代码审查
- [ ] PR 已创建
- [ ] 代码已审查
- [ ] 审查意见已解决
- [ ] PR 已合并

---

## 最后更新
**日期**: 2026-03-27
**更新人**: ___
**版本**: 1.0
