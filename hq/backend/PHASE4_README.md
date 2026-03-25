# Phase 4: Memory & Knowledge Layer

## 概述

Phase 4 实现了完整的记忆与知识层，为 AI 系统提供持久化记忆、知识检索和用户上下文管理功能。

## 组件架构

### 1. Memory Indexer (memory-indexer.ts)
文档索引和分类引擎。

**核心功能：**
- 扫描 `.ai/` 目录下的所有 Markdown 文件
- 按文档类型自动分类（notes, decisions, playbooks, agents, meetings, tasks）
- 基于内容哈希的去重
- 按修改时间排序和过滤
- 支持日期范围查询

**主要 API：**
```typescript
indexMemoryDocuments(memoryRootDir: string): MemoryDocument[]
categorizeDocument(relativePath: string): DocumentCategory
filterDocumentsByType(documents: MemoryDocument[], category: DocumentCategory): MemoryDocument[]
filterDocumentsByDateRange(documents: MemoryDocument[], fromMs?: number, toMs?: number): MemoryDocument[]
deduplicateDocuments(documents: MemoryDocument[]): MemoryDocument[]
```

### 2. Memory Retriever (memory-retriever.ts)
智能记忆检索引擎。

**核心功能：**
- TF-IDF 相关性评分
- Bigram 短语匹配
- 路径权重提升
- 最近的回退机制
- 查询结果缓存
- 上下文长度限制

**主要 API：**
```typescript
retrieveMemoryContext(query: string, options: RetrieveOptions): RetrievedMemoryContext
retrieveForTask(taskId: string, query: string, options: RetrieveOptions): RetrievedMemoryContext
retrieveProjectContext(options: RetrieveOptions): RetrievedMemoryContext
retrieveDecisions(query: string, options: RetrieveOptions): RetrievedMemoryContext
retrieveAgentContext(agentId: string, options: RetrieveOptions): RetrievedMemoryContext
retrieveKnowledge(query: string, options: RetrieveOptions): RetrievedMemoryContext
writeExecutionSummaryToMemory(task: Task, execution: Execution, options: WriteOptions): string
clearMemoryCache(): void
```

### 3. User Context Service (user-context-service.ts)
用户上下文和权限管理。

**核心功能：**
- 从环境变量或配置文件提取用户信息
- 访问级别验证（full, readonly, limited, admin）
- 基于权限的代理过滤
- 资源访问控制
- 自定义权限支持

**主要 API：**
```typescript
getCurrentUser(): UserContext
filterAgentsByUser(agents: Agent[], user: UserContext): Agent[]
checkAccess(user: UserContext, resourceLevel: string, operation?: 'read' | 'write'): boolean
```

### 4. Directory Initializer (directory-initializer.ts)
目录结构初始化和模板生成。

**核心功能：**
- 创建标准 `.ai/` 目录结构
- 生成文档模板
- 支持自定义目录和模板
- 目录结构验证
- 幂等操作（可重复运行）

**主要 API：**
```typescript
initializeAiDirectory(options: DirectoryInitOptions): DirectoryInitResult
createDirectoryStructure(aiDir: string, customDirs?: string[]): string[]
generateTemplateFiles(aiDir: string, customTemplates?: Record<string, string>): void
verifyDirectoryStructure(aiDir: string, options?: VerifyOptions): VerifyResult
```

## 目录结构

```
.ai/
├── notes/              # 通用笔记和观察
├── decisions/          # 架构和技术决策
├── playbooks/          # 标准操作流程
├── agents/             # 代理特定知识
├── meetings/           # 会议记录和总结
├── task-summaries/     # 执行摘要和结果
├── knowledge/          # 通用知识库
├── README.md           # 目录说明
├── .gitignore          # Git 忽略规则
└── user.json           # 用户配置（需手动创建）
```

## 测试覆盖

### 测试统计
- **总测试数**: 104
- **通过**: 97 (93.3%)
- **失败**: 7 (6.7%)

### 测试分类
1. **Unit Tests** (单元测试)
   - 文档索引逻辑
   - 分类和过滤
   - 去重算法
   - 用户权限验证
   - 目录初始化

2. **Integration Tests** (集成测试)
   - 端到端工作流
   - 任务执行摘要
   - 项目上下文聚合
   - 缓存失效
   - 多语言处理

3. **Edge Cases** (边界情况)
   - 空目录处理
   - 无匹配结果
   - 权限拒绝
   - 大规模文档（100+）
   - 并发访问
   - 损坏状态恢复

### 运行测试

```bash
# 运行所有 Phase 4 测试
./test-phase4.sh

# 或手动运行
cd hq/backend
npm run build
node --test dist/__tests__/memory-*.test.js \
             dist/__tests__/user-context-service.test.js \
             dist/__tests__/directory-initializer.test.js \
             dist/__tests__/memory-layer-integration.test.js
```

## 使用示例

### 初始化记忆目录

```typescript
import { initializeAiDirectory } from './memory/directory-initializer';

const result = initializeAiDirectory({
  rootDir: '/path/to/project',
  force: false,        // 不覆盖现有目录
  templates: true,     // 生成模板文件
  customDirs: ['custom'],  // 自定义目录
});

console.log(`Created: ${result.created.join(', ')}`);
```

### 检索相关上下文

```typescript
import { retrieveMemoryContext } from './memory/memory-retriever';

const context = retrieveMemoryContext('API gateway rate limiting', {
  memoryRootDir: '/path/to/project/.ai',
  limit: 3,
  excerptMaxChars: 300,
  contextMaxChars: 1600,
});

console.log(context.entries);
// [
//   { relativePath: 'notes/routing.md', excerpt: '...', score: 8.5 },
//   { relativePath: 'task-summaries/2026-03-25-task-123.md', excerpt: '...', score: 6.2 }
// ]

console.log(context.context);
// #1 notes/routing.md
// Use API gateway for external requests...
//
// #2 task-summaries/2026-03-25-task-123.md
// Rate limiting implemented with 100 req/s limit...
```

### 写入执行摘要

```typescript
import { writeExecutionSummaryToMemory } from './memory/memory-retriever';

const filePath = writeExecutionSummaryToMemory(
  {
    id: 'task-123',
    title: 'Implement API Gateway',
    description: 'Build rate limiting and authentication',
    executionMode: 'single',
  },
  {
    id: 'exec-1',
    status: 'completed',
    executor: 'codex',
    outputSummary: 'Rate limiting implemented with 100 req/s limit.',
    errorMessage: '',
  },
  {
    memoryRootDir: '/path/to/project/.ai',
    now: new Date(),
  }
);

console.log(`Summary written to: ${filePath}`);
// Summary written to: /path/to/project/.ai/task-summaries/2026-03-25-task-123.md
```

### 用户权限管理

```typescript
import { getCurrentUser, filterAgentsByUser, checkAccess } from './memory/user-context-service';

const user = getCurrentUser();
// { id: 'alice', name: 'Alice', homeDir: '/home/alice', accessLevel: 'limited' }

const agents = [
  { id: 'public-agent', name: 'Public Agent', access: 'public' },
  { id: 'internal-agent', name: 'Internal Agent', access: 'internal' },
];

const filtered = filterAgentsByUser(agents, user);
// [{ id: 'public-agent', name: 'Public Agent', access: 'public' }]

const canAccess = checkAccess(user, 'internal');
// false
```

## 性能特性

- **增量索引**: 只扫描变更的文件
- **智能缓存**: LRU 缓存查询结果
- **惰性加载**: 按需读取文件内容
- **去重优化**: 基于哈希的快速去重
- **分页支持**: 限制返回结果数量

## 最佳实践

1. **定期清理**: 删除过时的任务摘要和笔记
2. **标签使用**: 在文档中使用一致的标签便于检索
3. **决策记录**: 使用 `decisions/` 目录记录重要决策
4. **模板定制**: 根据团队需求定制文档模板
5. **权限管理**: 为不同用户配置适当的访问级别

## 故障排除

### 常见问题

**Q: 检索结果不相关**
A: 检查查询词是否在文档中出现，尝试使用更具体的关键词。

**Q: 缓存导致旧结果**
A: 调用 `clearMemoryCache()` 清除缓存，或设置 `useCache: false`。

**Q: 权限被拒绝**
A: 检查 `user.json` 配置和 `AGENT_ACCESS_LEVEL` 环境变量。

**Q: 目录结构损坏**
A: 运行 `initializeAiDirectory({ force: true })` 重建目录。

## 下一步

- [ ] 修复剩余 7 个失败的测试（主要是边界情况）
- [ ] 添加性能基准测试
- [ ] 实现向量嵌入支持（语义搜索）
- [ ] 添加自动清理策略
- [ ] 支持分布式记忆存储
- [ ] 添加记忆导出/导入功能

## 相关文档

- [测试摘要](./PHASE4_TEST_SUMMARY.md) - 详细的测试覆盖报告
- [TDD 工作流](../CLAUDE.md) - 测试驱动开发方法
- [项目架构](../README.md) - 整体系统架构

## 贡献

欢迎提交问题和拉取请求！在提交 PR 前，请确保：

1. 所有测试通过：`npm test`
2. 代码覆盖率 > 80%
3. 遵循 TDD 原则（先写测试，再实现）
4. 添加适当的文档和注释

## 许可证

MIT
