# 测试实施快速指南

## 立即开始：TDD 工作流

### 第一步：创建测试文件结构

```bash
# 创建后端测试目录
mkdir -p hq/backend/src/__tests__/market

# 创建前端测试目录
mkdir -p hq/frontend/src/components/__tests__
mkdir -p hq/frontend/src/hooks/__tests__

# 创建 E2E 测试目录（已存在）
# hq/frontend/tests/e2e/
```

---

### 第二步：从 P0 测试开始（TDD 红绿重构）

#### 1. Candidate Repository 测试（最先实现）

**为什么最先**: 这是数据持久化层，其他服务都依赖它。

**创建文件**: `hq/backend/src/__tests__/market/candidate-repository.test.ts`

```bash
cd hq/backend
# 红色：写测试（预期失败）
touch src/__tests__/market/candidate-repository.test.ts
```

**第一个测试用例**（从简单开始）:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createFileCandidateRepository,
  createInMemoryCandidateRepository,
} from '../market/candidate-repository';
import type { Candidate } from '../market/candidate-repository';

function makeCandidate(overrides?: Partial<Candidate>): Candidate {
  return {
    id: 'candidate-1',
    repositoryUrl: 'https://github.com/example/repo',
    source: 'github',
    repositoryName: 'example/repo',
    description: 'Test repository',
    stars: 100,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test('saveCandidate stores candidate with generated ID', async () => {
  // Arrange
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-repo-'));
  const repository = createFileCandidateRepository(tempDir + '/candidates.json');
  const candidate = makeCandidate({ id: '' }); // Empty ID to test generation

  // Act
  const saved = await repository.save(candidate);

  // Assert
  assert.ok(saved.id);
  assert.ok(saved.id.length > 0);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
});
```

**运行测试**（红色阶段 - 应该失败）:

```bash
npm run test -- src/__tests__/market/candidate-repository.test.ts
```

**实现最小代码**（绿色阶段 - 让测试通过）:

在 `src/market/candidate-repository.ts` 中：

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function saveCandidate(candidate: Candidate): Promise<Candidate> {
  const saved = {
    ...candidate,
    id: candidate.id || randomUUID(),
  };
  // ... rest of implementation
  return saved;
}
```

**运行测试**（绿色阶段 - 应该通过）:

```bash
npm run test -- src/__tests__/market/candidate-repository.test.ts
```

**重构**（改进阶段 - 优化代码）:

- 提取重复逻辑
- 改进命名
- 优化性能
- **测试必须保持绿色**

---

#### 2. GitHub Search 测试（第二个实现）

**创建文件**: `hq/backend/src/__tests__/market/github-search.test.ts`

**Mock 工具安装**（如果需要）:

```bash
npm install --save-dev nock
# 或
npm install --save-dev msw
```

**第一个测试用例**:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import { GitHubSearchService } from '../market/github-search';

test('search returns formatted candidates with valid token', async () => {
  // Arrange
  const token = 'test-token';
  const query = 'react';

  nock('https://api.github.com')
    .get('/search/repositories')
    .query({ q: query, per_page: 10 })
    .reply(200, {
      items: [
        {
          id: 1,
          full_name: 'facebook/react',
          description: 'React library',
          html_url: 'https://github.com/facebook/react',
          stargazers_count: 200000,
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
    });

  const service = new GitHubSearchService(token);

  // Act
  const results = await service.search(query, 10);

  // Assert
  assert.equal(results.length, 1);
  assert.equal(results[0].repositoryName, 'facebook/react');
  assert.equal(results[0].source, 'github');

  nock.cleanAll();
});
```

---

#### 3. Candidate Evaluator 测试（第三个实现）

**创建文件**: `hq/backend/src/__tests__/market/candidate-evaluator.test.ts`

**第一个测试用例**:

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidate } from '../market/candidate-evaluator';

test('evaluateCandidate calculates correct score from all factors', async () => {
  // Arrange
  const candidate = makeCandidate({
    stars: 5000,        // 30 points (max)
    recentCommits: 100, // 25 points (max)
    contributors: 50,   // 20 points (max)
    hasReadme: true,    // 15 points (max)
    hasLicense: true,   // 10 points (max)
  });

  // Act
  const evaluation = await evaluateCandidate(candidate);

  // Assert
  assert.equal(evaluation.score, 100);
  assert.equal(evaluation.rating, 'recommended');
  assert.equal(evaluation.tier, 'excellent');
});
```

---

### 第三步：API 集成测试

**创建文件**: `hq/backend/src/__tests__/integration/market-routes.test.ts`

**参考现有测试**: `src/__tests__/approvals.routes.test.ts`

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import type express from 'express';
import { registerMarketRoutes } from '../api/market';
import { createMockApp, MockResponse } from '../test-utils/express-mocks';

test('POST /api/market/search returns candidates from GitHub', async () => {
  // Arrange
  const app = createMockApp();
  const mockService = {
    search: async () => [makeCandidate()],
  };

  registerMarketRoutes(app, mockService);

  // Act
  const res = await invoke(app.handlers, 'POST', '/api/market/search', {
    body: { query: 'react', maxResults: 10 },
  });

  // Assert
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.candidates.length, 1);
});
```

---

### 第四步：前端组件测试

**创建文件**: `hq/frontend/src/components/__tests__/TalentMarket.test.tsx`

**安装测试依赖**（如果需要）:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**第一个测试用例**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TalentMarket } from '../TalentMarket';

// Mock API
jest.mock('@/lib/api', () => ({
  searchCandidates: jest.fn(),
}));

test('search button triggers search API call', () => {
  // Arrange
  render(<TalentMarket />);
  const input = screen.getByPlaceholderText('搜索候选项目');
  const button = screen.getByRole('button', { name: '搜索' });

  // Act
  fireEvent.change(input, { target: { value: 'react' } });
  fireEvent.click(button);

  // Assert
  expect(mockSearchCandidates).toHaveBeenCalledWith('react', 10);
});
```

---

### 第五步：E2E 测试（最后实现）

**创建文件**: `hq/frontend/tests/e2e/talent-market.spec.ts`

**第一个测试用例**:

```typescript
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await mockMarketApi(page);
});

test('user can search for candidates on GitHub', async ({ page }) => {
  // Act
  await page.goto('/market');
  await page.getByPlaceholder('搜索候选项目').fill('react');
  await page.getByRole('button', { name: '搜索' }).click();

  // Assert
  await expect(page.getByText('搜索结果')).toBeVisible();
  await expect(page.getByText('facebook/react')).toBeVisible();
});
```

---

## 测试运行命令速查

### 后端

```bash
# 运行所有测试
npm run test

# 运行特定文件
npm run test -- src/__tests__/market/candidate-repository.test.ts

# 运行匹配模式的测试
npm run test -- --test-name-pattern="saveCandidate"

# 监听模式（自动重新运行）
npm run test -- --watch

# Coverage
npm run test:coverage
```

### 前端

```bash
# 运行单元测试
npm run test

# 运行 E2E 测试
npm run test:e2e

# 运行特定 E2E 文件
npx playwright test talent-market.spec.ts

# 调试 E2E 测试
npx playwright test --debug

# 查看测试报告
npx playwright show-report
```

---

## 测试实施检查清单

### 开始前
- [ ] 已阅读完整的 TEST_PLAN.md
- [ ] 已理解 TDD 红绿重构流程
- [ ] 已准备好测试数据生成器

### 实施中
- [ ] 先写测试，再看它失败（红色）
- [ ] 写最小代码让测试通过（绿色）
- [ ] 重构代码，测试保持绿色（改进）
- [ ] 每个测试用例独立运行
- [ ] 使用 Mock 隔离外部依赖

### 完成后
- [ ] 所有测试通过
- [ ] 覆盖率达到 80%+
- [ ] 无 `console.log` 残留
- [ ] 代码审查通过
- [ ] 文档已更新

---

## 常见问题

### Q: 测试应该多详细？
A: 遵循 **测试金字塔**：
- 底层（单元测试）：多量、快速、详细
- 中层（集成测试）：中量、中等速度
- 顶层（E2E 测试）：少量、慢速、覆盖关键流程

### Q: 如何测试异步代码？
A: 使用 `async/await`:
```typescript
test('async operation', async () => {
  const result = await asyncFunction();
  assert.equal(result, expected);
});
```

### Q: 如何 Mock 外部 API？
A: 使用 `nock`（后端）或 `msw`（前端）:
```typescript
nock('https://api.github.com')
  .get('/search/repositories')
  .reply(200, { items: [] });
```

### Q: 如何测试错误场景？
A: Mock 错误响应:
```typescript
nock('https://api.github.com')
  .get('/search/repositories')
  .reply(500, { error: 'Internal Server Error' });
```

### Q: 如何保证测试独立性？
A:
- 每个测试使用独立数据
- 使用临时目录（`fs.mkdtempSync`）
- 清理 Mock（`nock.cleanAll()`）

---

## 下一步

1. **立即开始**: 创建 `candidate-repository.test.ts` 并编写第一个测试
2. **参考模板**: 使用本文档中的代码模板
3. **遵循 TDD**: 红色 -> 绿色 -> 改进
4. **持续迭代**: 根据覆盖报告补充测试

祝测试编写愉快！记住：**测试是代码质量的守护者**。
