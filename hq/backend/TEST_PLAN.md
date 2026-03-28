# 测试计划：人才市场与组织架构重构

## 概述

本测试计划覆盖人才市场（Talent Market）功能的后端和前端测试，确保从外部平台（GitHub、npm）发现候选人、评估能力、导入为员工的完整流程的质量。

---

## 后端测试（hq/backend/src/__tests__/）

### 1. GitHub 搜索服务单元测试
**文件路径**: `src/__tests__/market/github-search.test.ts`

**优先级**: P0（核心功能）

**核心测试用例**:

```typescript
// 1.1 成功场景
test('GitHub search returns formatted candidates with valid token')
test('GitHub search handles pagination correctly')
test('GitHub search respects query parameters (language, stars, forks)')
test('GitHub search deduplicates candidates by URL')

// 1.2 错误处理
test('GitHub search returns empty array on authentication failure')
test('GitHub search handles rate limiting gracefully')
test('GitHub search handles network errors')
test('GitHub search validates missing GITHUB_TOKEN environment variable')

// 1.3 边界条件
test('GitHub search returns empty array for no results')
test('GitHub search handles malformed API responses')
test('GitHub search handles timeout')
test('GitHub search limits results to maxResults parameter')
```

**Mock 策略**:
- 使用 `nock` 或 `msw` 拦截 HTTP 请求
- Mock GitHub API 响应（成功、失败、限流）
- Mock 环境变量（GITHUB_TOKEN）

**数据生成器**:
```typescript
function makeGitHubSearchResponse(overrides?: Partial<GitHubSearchResponse>): GitHubSearchResponse
function makeGitHubRepository(overrides?: Partial<GitHubRepository>): GitHubRepository
```

---

### 2. 评估算法单元测试
**文件路径**: `src/__tests__/market/candidate-evaluator.test.ts`

**优先级**: P0（核心业务逻辑）

**核心测试用例**:

```typescript
// 2.1 评分算法
test('evaluateCandidate calculates correct score from all factors')
test('evaluateCandidate weights stars appropriately (0-30 points)')
test('evaluateCandidate weights recent commits appropriately (0-25 points)')
test('evaluateCandidate weights contributor count appropriately (0-20 points)')
test('evaluateCandidate weights README quality appropriately (0-15 points)')
test('evaluateCandidate weights license appropriately (0-10 points)')
test('evaluateCandidate assigns correct tier based on score')
test('evaluateCandidate assigns correct rating based on score')

// 2.2 能力识别
test('identifyCapabilities detects engineering from repository topics')
test('identifyCapabilities detects design from repository topics')
test('identifyCapabilities detects marketing from repository topics')
test('identifyCapabilities extracts specialties from description')
test('identifyCapabilities handles missing README gracefully')
test('identifyCapabilities handles missing topics gracefully')

// 2.3 README 质量评估
test('assessReadmeQuality returns full score for comprehensive README')
test('assessReadmeQuality penalizes missing sections')
test('assessReadmeQuality handles empty README')
test('assessReadmeQuality handles non-markdown READMEs')

// 2.4 边界条件
test('evaluateCandidate handles zero stars')
test('evaluateCandidate handles repositories with no commits')
test('evaluateCandidate handles repositories with no contributors')
test('evaluateCandidate handles repositories without license')
test('evaluateCandidate caps score at 100')
```

**Mock 策略**:
- Mock GitHub API 请求（README 内容、仓库详情）
- Mock 日期比较（用于"最近活跃"判断）

**数据生成器**:
```typescript
function makeCandidate(overrides?: Partial<Candidate>): Candidate
function makeGitHubRepository(overrides?: Partial<GitHubRepository>): GitHubRepository
function makeReadmeContent(sections: string[]): string
```

**评分覆盖表**:
| 分数范围 | 评级 | 层级 |
|---------|------|------|
| 80-100  | recommended | excellent |
| 60-79   | consider | good |
| 40-59   | consider | fair |
| 0-39    | not-recommended | poor |

---

### 3. 候选池 Repository 单元测试
**文件路径**: `src/__tests__/market/candidate-repository.test.ts`

**优先级**: P0（数据持久化核心）

**核心测试用例**:

```typescript
// 3.1 CRUD 操作
test('saveCandidate stores candidate with generated ID')
test('saveCandidate prevents duplicate URLs within same source')
test('getCandidate retrieves stored candidate by ID')
test('listCandidates returns all candidates')
test('listCandidates filters by source')
test('listCandidates filters by capability category')
test('updateCandidate updates existing candidate')
test('deleteCandidate removes candidate from pool')

// 3.2 导入状态管理
test('markAsImported sets importedAs field')
test('listUnimported returns only non-imported candidates')
test('listImported returns only imported candidates')
test('markAsImported prevents duplicate imports')

// 3.3 持久化层测试（File + Memory）
test('FileCandidateRepository persists to JSON file')
test('FileCandidateRepository loads from existing JSON file')
test('FileCandidateRepository handles file system errors')
test('InMemoryCandidateRepository stores in memory')
test('InMemoryCandidateRepository isolates instances')

// 3.4 边界条件
test('saveCandidate handles missing required fields')
test('getCandidate returns null for non-existent ID')
test('updateCandidate returns null for non-existent ID')
test('deleteCandidate handles non-existent ID gracefully')
test('listCandidates returns empty array when pool is empty')
```

**Mock 策略**:
- 使用临时目录进行文件系统测试（`fs.mkdtempSync`）
- Mock 文件系统错误（权限、磁盘空间）

**数据生成器**:
```typescript
function makeCandidate(overrides?: Partial<Candidate>): Candidate
function makeCandidateEvaluation(overrides?: Partial<CandidateEvaluation>): CandidateEvaluation
function makeTempDir(): string
```

---

### 4. API 集成测试
**文件路径**: `src/__tests__/integration/market-routes.test.ts`

**优先级**: P1（API 契约）

**核心测试用例**:

```typescript
// 4.1 搜索端点
test('POST /api/market/search returns candidates from GitHub')
test('POST /api/market/search validates required query parameter')
test('POST /api/market/search validates maxResults limit (1-100)')
test('POST /api/market/search returns 501 when GitHub token missing')
test('POST /api/market/search handles service errors gracefully')

// 4.2 评估端点
test('POST /api/market/evaluate returns evaluation with score')
test('POST /api/market/evaluate identifies capabilities')
test('POST /api/market/evaluate validates candidate ID parameter')
test('POST /api/market/evaluate returns 404 for non-existent candidate')

// 4.3 列表端点
test('GET /api/market/candidates returns all candidates')
test('GET /api/market/candidates filters by source')
test('GET /api/market/candidates filters by imported status')
test('GET /api/market/candidates supports pagination')

// 4.4 详情端点
test('GET /api/market/candidates/:id returns candidate details')
test('GET /api/market/candidates/:id returns 404 for non-existent ID')

// 4.5 导入端点
test('POST /api/market/candidates/:id/import creates agent from candidate')
test('POST /api/market/candidates/:id/import validates not already imported')
test('POST /api/market/candidates/:id/import returns 501 when agent service unavailable')
test('POST /api/market/candidates/:id/import maps capabilities to agent roles')

// 4.6 删除端点
test('DELETE /api/market/candidates/:id removes candidate')
test('DELETE /api/market/candidates/:id returns 404 for non-existent ID')
```

**Mock 策略**:
- Mock Express Request/Response（使用 `MockResponse` 类）
- Mock Service 层（CandidateService, AgentService）
- Mock GitHub API 调用

**测试工具**:
```typescript
class MockResponse {
  status(code: number): MockResponse
  json(payload: unknown): MockResponse
}

function createMockApp(): express.Application & { handlers: Map<string, RouteHandler> }
async function invoke(handlers, method, path, req): Promise<MockResponse>
```

---

## 前端测试（hq/frontend/）

### 5. 市场页面组件测试
**文件路径**: `src/components/__tests__/TalentMarket.test.tsx`

**优先级**: P1（核心 UI）

**核心测试用例**:

```typescript
// 5.1 搜索功能
test('search form validates query input required')
test('search form validates maxResults range (1-100)')
test('search button triggers search API call')
test('search results display candidate cards')
test('search results show empty state when no results')
test('search results show error state on API failure')
test('search results show loading state during fetch')

// 5.2 候选人卡片
test('candidate card displays repository name and description')
test('candidate card displays evaluation score and rating')
test('candidate card displays capability tags')
test('candidate card displays source icon (GitHub/npm)')
test('candidate card displays import button for unimported candidates')
test('candidate card displays imported badge for imported candidates')
test('candidate card links to repository URL')

// 5.3 筛选和排序
test('filter dropdown filters by source')
test('filter dropdown filters by imported status')
test('sort dropdown sorts by score (descending)')
test('sort dropdown sorts by stars (descending)')
test('sort dropdown sorts by updated date (descending)')
test('combined filters work correctly')

// 5.4 导入功能
test('import button opens confirmation dialog')
test('import confirmation displays candidate summary')
test('import confirmation calls import API on confirm')
test('import confirmation closes on cancel')
test('import success shows toast notification')
test('import failure shows error message')
test('import button disabled for already imported candidates')

// 5.5 分页
test('pagination displays correct page count')
test('pagination navigation changes page')
test('pagination respects page size limit')
```

**Mock 策略**:
- Mock API calls（`fetch`, `axios`）
- Mock React Router navigation
- Mock Toast notifications

**测试工具**:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock data generators
function makeMockCandidate(overrides?: Partial<Candidate>): Candidate
function makeMockEvaluation(overrides?: Partial<CandidateEvaluation>): CandidateEvaluation
```

---

### 6. Hooks 测试（如需要）
**文件路径**: `src/hooks/__tests__/useTalentMarket.test.ts`

**优先级**: P2（可复用逻辑）

**核心测试用例**:

```typescript
// 6.1 数据获取
test('useTalentMarket fetches candidates on mount')
test('useTalentMarket handles loading state')
test('useTalentMarket handles error state')
test('useTalentMarket refetches on refetch callback')

// 6.2 搜索操作
test('useTalentMarket.searchCandidates calls search API')
test('useTalentMarket.searchCandidates updates candidates list')
test('useTalentMarket.searchCandidates handles errors')

// 6.3 导入操作
test('useTalentMarket.importCandidate calls import API')
test('useTalentMarket.importCandidate updates candidate imported status')
test('useTalentMarket.importCandidate handles errors')
```

**Mock 策略**:
- Mock `useSWR` 或 `useQuery`（如使用数据获取库）
- Mock API calls

---

### 7. E2E 测试
**文件路径**: `tests/e2e/talent-market.spec.ts`

**优先级**: P0（关键用户流程）

**核心测试用例**:

```typescript
// 7.1 完整搜索流程
test('user can search for candidates on GitHub')
test('search results display correctly')
test('user can filter search results by source')
test('user can sort search results by score')

// 7.2 完整导入流程
test('user can view candidate details')
test('user can import a candidate as agent')
test('imported candidate appears in organization page')
test('imported candidate is marked as imported in market')

// 7.3 错误场景
test('user sees error message when search fails')
test('user sees error message when import fails')
test('user can retry failed operations')

// 7.4 空状态
test('user sees empty state when no candidates exist')
test('user sees empty state when search returns no results')
test('user sees helpful message in empty state')

// 7.5 导航流程
test('user can navigate from dashboard to talent market')
test('user can navigate from talent market to organization')
test('browser back button works correctly')
```

**Mock 策略**:
- 使用 `page.route()` Mock API 响应
- Mock WebSocket 事件（如需要实时更新）

**测试数据准备**:
```typescript
function mockMarketApi(page: Page) {
  // Mock all market-related API endpoints
  // POST /api/market/search
  // GET /api/market/candidates
  // POST /api/market/candidates/:id/evaluate
  // POST /api/market/candidates/:id/import
}
```

---

## 优先级排序

### P0 - 必须实现（阻塞发布）
1. GitHub 搜索服务单元测试（后端）
2. 评估算法单元测试（后端）
3. 候选池 Repository 单元测试（后端）
4. E2E 测试（前端）

### P1 - 高优先级（影响用户体验）
5. API 集成测试（后端）
6. 市场页面组件测试（前端）

### P2 - 中优先级（质量保证）
7. Hooks 测试（前端）

---

## Mock 策略总结

### 后端 Mock
- **HTTP 请求**: `nock` 或 `msw`
- **文件系统**: 临时目录 + Mock 错误
- **环境变量**: `process.env` 赋值
- **Express**: `MockResponse` 类 + `createMockApp`

### 前端 Mock
- **API 调用**: `jest.mock()` 或 `msw`
- **React Router**: `MemoryRouter`
- **Toast**: Mock 实现
- **E2E**: `page.route()` 拦截网络请求

---

## 测试覆盖率目标

| 类型 | 覆盖率目标 |
|------|----------|
| 语句覆盖 | 80%+ |
| 分支覆盖 | 80%+ |
| 函数覆盖 | 90%+ |
| 行覆盖 | 80%+ |

---

## 测试执行顺序

### 阶段 1：单元测试（TDD 红绿重构）
1. 实现 Candidate Repository 测试
2. 实现 GitHub Search 测试
3. 实现 Candidate Evaluator 测试

### 阶段 2：集成测试
4. 实现 API Routes 测试

### 阶段 3：前端测试
5. 实现组件测试
6. 实现 Hooks 测试

### 阶段 4：E2E 测试
7. 实现端到端测试

---

## 持续集成配置

### 后端测试命令
```bash
# 运行所有测试
npm run test

# 运行特定测试文件
node --test dist/__tests__/market/github-search.test.js

# 运行 coverage
npm run test:coverage
```

### 前端测试命令
```bash
# 运行单元测试
npm run test

# 运行 E2E 测试
npm run test:e2e

# 运行特定 E2E 测试
npx playwright test talent-market.spec.ts
```

---

## 测试数据管理

### 测试数据原则
1. **确定性**: 使用固定数据，不依赖随机生成
2. **隔离性**: 每个测试独立运行，不共享状态
3. **可读性**: 使用 `makeXxx()` 工厂函数清晰构建测试数据
4. **真实性**: 测试数据应接近真实场景

### 测试数据示例
```typescript
// 高质量候选（用于测试优秀评分）
const EXCELLENT_CANDIDATE = makeCandidate({
  stars: 5000,
  recentCommits: 100,
  contributors: 50,
  hasReadme: true,
  hasLicense: true,
  topics: ['react', 'typescript', 'frontend']
})

// 低质量候选（用于测试差评评分）
const POOR_CANDIDATE = makeCandidate({
  stars: 5,
  recentCommits: 0,
  contributors: 1,
  hasReadme: false,
  hasLicense: false,
  topics: []
})
```

---

## 质量检查清单

### 测试编写后检查
- [ ] 所有公共函数有单元测试
- [ ] 所有 API 端点有集成测试
- [ ] 关键用户流程有 E2E 测试
- [ ] 边界条件已覆盖（null、空数组、无效输入）
- [ ] 错误路径已测试（非仅快乐路径）
- [ ] 外部依赖已 Mock（GitHub API、文件系统）
- [ ] 测试之间独立（无共享状态）
- [ ] 断言具体且有意义
- [ ] 覆盖率达到 80%+

### 提交前检查
- [ ] 所有测试通过
- [ ] 无 `console.log` 残留
- [ ] 无硬编码密钥
- [ ] TypeScript 类型检查通过
- [ ] 代码符合编码规范

---

## 下一步行动

1. **立即开始**: 实现 P0 优先级测试（遵循 TDD 红绿重构）
2. **并行开发**: 后端单元测试与前端 E2E 测试可并行编写
3. **迭代优化**: 根据测试覆盖报告补充边界条件测试
4. **持续集成**: 将测试集成到 CI/CD 流程

---

## 附录：测试文件模板

### 后端单元测试模板
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubSearchService } from '../market/github-search';

// Enable mock mode for tests
process.env.AGENCY_TEST_MODE = 'mock';

function makeMockCandidate(overrides?: Partial<Candidate>): Candidate {
  return {
    id: 'candidate-1',
    repositoryUrl: 'https://github.com/example/repo',
    source: 'github',
    ...overrides,
  };
}

test('description of what is being tested', async () => {
  // Arrange
  const service = new GitHubSearchService();
  const candidate = makeMockCandidate();

  // Act
  const result = await service.someMethod(candidate);

  // Assert
  assert.equal(result.field, expectedValue);
});
```

### 前端组件测试模板
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TalentMarket } from '../TalentMarket';

// Mock API calls
jest.mock('@/lib/api', () => ({
  searchCandidates: jest.fn(),
  importCandidate: jest.fn(),
}));

test('description of what is being tested', () => {
  // Arrange
  render(<TalentMarket />);

  // Act
  const button = screen.getByRole('button', { name: 'Search' });
  fireEvent.click(button);

  // Assert
  expect(screen.getByText('Results')).toBeInTheDocument();
});
```

### E2E 测试模板
```typescript
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await mockMarketApi(page);
});

test('description of user flow', async ({ page }) => {
  await page.goto('/market');
  await page.getByPlaceholder('Search').fill('react');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('Results')).toBeVisible();
});
```
