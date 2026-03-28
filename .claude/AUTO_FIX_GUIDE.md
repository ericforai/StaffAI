# 自动化测试修复系统 - 使用指南

## 概述

这是一个测试驱动的自动化代码修复系统，可以：

- 自动检测测试失败
- 分析失败原因
- 生成修复任务
- 验证修复质量
- 自动提交代码

## 快速开始

### 方式 1: 使用 npm scripts（推荐）

```bash
cd hq/backend

# 运行完整修复循环
npm run auto-fix

# 查看状态
npm run auto-fix:status

# 查看历史
npm run auto-fix:history

# 重置状态
npm run auto-fix:reset
```

### 方式 2: 直接使用 TypeScript 脚本

```bash
# 从项目根目录
npx ts-node .claude/scripts/fix.ts run
npx ts-node .claude/scripts/fix.ts status
npx ts-node .claude/scripts/fix.ts history
npx ts-node .claude/scripts/fix.ts reset
```

### 方式 3: 使用 Bash 脚本

```bash
.claude/scripts/auto-fix-loop.sh
```

## 工作流程详解

```
┌────────────────────────────────────────────────────────────────┐
│                        开始修复循环                             │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   运行测试套件    │
                    └─────────────────┘
                              │
                    ┌─────────────────┐
                    │    测试通过？     │
                    └─────────────────┘
                     │              │
                    是              否
                     │              │
                     ▼              ▼
              ┌──────────┐   ┌─────────────┐
              │  ✅ 完成  │   │ 分析失败测试  │
              └──────────┘   └─────────────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │ 生成修复任务  │
                             └─────────────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │ Claude 修复 │
                             └─────────────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │  质量门禁检查 │
                             └─────────────┘
                                    │
                        ┌───────────┴───────────┐
                       通过                     失败
                        │                         │
                        ▼                         ▼
                ┌───────────┐            ┌─────────────┐
                │ 自动提交  │            │ 重试/人工介入 │
                └───────────┘            └─────────────┘
```

## 质量门禁

修复完成后，系统会检查：

| 检查项 | 要求 | 验证方式 |
|--------|------|----------|
| 测试通过 | 100% | `npm run test` |
| 类型安全 | 无错误 | `npm run build` |
| 覆盖率 | >= 80% | 测试报告 |
| 代码审查 | 通过 | `code-reviewer` agent |

## 安全护栏

- ✅ 自动 `git commit`（本地）
- ❌ 禁止 `git push --force`
- ✅ 最大尝试次数限制（默认 5 次）
- ✅ 超时保护（默认 5 分钟）
- ❌ 阻止危险命令（`rm -rf`, `DROP TABLE` 等）

## 文件说明

```
.claude/
├── scripts/
│   ├── fix.ts                    # 主要 CLI 脚本
│   ├── autonomous-loop.ts        # 高级循环脚本
│   ├── auto-fix-loop.sh          # Bash 版本
│   └── AUTO_FIX_README.md        # 详细文档
├── agents/
│   └── auto-fixer.md             # 修复 agent
├── skills/
│   └── auto-fix-loop.md          # 技能定义
├── config/
│   └── auto-fix.json             # 权限配置
├── state/                        # 运行时状态
│   ├── fix-task-N.md             # 修复任务
│   ├── fix-history.json          # 修复历史
│   └── summary.md                # 执行摘要
└── logs/                         # 运行日志
    └── auto-fix-*.log
```

## 高级用法

### 持续监控模式

使用 `/loop` 命令设置持续监控：

```bash
# 每 10 分钟运行一次修复循环
/loop 10m npm run auto-fix
```

### 与 CI/CD 集成

在 GitHub Actions 中自动修复失败的 CI：

```yaml
# .github/workflows/auto-fix.yml
name: Auto Fix CI Failures
on:
  workflow_run:
    workflows: ["Tests"]
    types: [completed]
    branches: [main]

jobs:
  auto-fix:
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd hq/backend && npm ci

      - name: Run auto-fix loop
        run: cd hq/backend && npm run auto-fix

      - name: Create PR if fixed
        if: success()
        run: |
          gh pr create \
            --title "fix: automated test failure fix" \
            --body "Automatically fixed failing tests" \
            --base main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 自定义配置

编辑 `.claude/scripts/fix.ts` 中的配置：

```typescript
const CONFIG = {
  maxAttempts: 10,           // 最大尝试次数
  coverageThreshold: 80,     // 覆盖率阈值
  branchPrefix: 'auto-fix/', // 分支前缀
  timeoutSeconds: 600        // 超时时间
}
```

## 故障排除

### 问题：脚本卡住不动

```bash
# 检查状态
npm run auto-fix:status

# 查看日志
cat .claude/logs/auto-fix-*.log

# 重置状态
npm run auto-fix:reset
```

### 问题：修复后测试仍然失败

```bash
# 查看修复历史
npm run auto-fix:history

# 手动检查代码
git diff HEAD

# 回滚到之前的状态
git reset --hard HEAD
```

### 问题：需要跳过某个修复

```bash
# 标记跳过
echo "skip" > .claude/state/skip-current.txt

# 重新运行
npm run auto-fix
```

## 最佳实践

1. **定期运行**: 在提交代码前运行 `npm run auto-fix`
2. **检查历史**: 使用 `npm run auto-fix:history` 了解修复趋势
3. **代码审查**: 即使自动修复，也要进行人工审查
4. **保持测试质量**: 自动修复依赖于良好的测试覆盖

## 与现有工具集成

### 与 `/ship` 工作流集成

```bash
# 1. 运行自动修复
npm run auto-fix

# 2. 运行 code review
/code-review

# 3. 创建 PR 并合并
/ship
```

### 与 `/verify` 集成

```bash
# 自动修复后验证
npm run auto-fix && /verify
```

## 贡献

欢迎改进！提交 PR 到 `.claude/scripts/` 目录。
