# 自动化测试修复循环

测试驱动的自动化代码修复系统，包含安全护栏和质量门禁。

## 快速开始

```bash
# 方式 1: 使用技能（推荐）
/auto-fix

# 方式 2: 直接运行脚本
cd .claude/scripts && ./auto-fix-loop.sh

# 方式 3: TypeScript 版本（更强大）
npx ts-node .claude/scripts/autonomous-loop.ts
```

## 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                    自动修复循环                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ 运行测试  │──▶│ 分析失败  │──▶│ 修复代码  │──▶│ 验证测试  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│   通过?         失败列表        最小修复      质量门禁       │
│   │                                                            │
│   ├── 是 ──▶ ✅ 完成                                           │
│   │                                                            │
│   └── 否 ──▶ 继续下一轮尝试                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 文件结构

```
.claude/
├── scripts/
│   ├── auto-fix-loop.sh          # Bash 版本
│   └── autonomous-loop.ts         # TypeScript 版本（推荐）
├── agents/
│   └── auto-fixer.md              # 修复 agent 定义
├── skills/
│   └── auto-fix-loop.md           # 技能定义
├── config/
│   └── auto-fix.json              # 权限配置
├── state/
│   ├── fix-task-N.md              # 每次修复任务
│   ├── fix-history.json           # 修复历史
│   └── summary.md                 # 执行摘要
└── logs/
    └── auto-fix-YYYYMMDD.log      # 运行日志
```

## 质量门禁

每个修复必须满足：

| 门禁 | 要求 | 命令 |
|------|------|------|
| 测试通过 | 100% | `npm run test` |
| 覆盖率 | >= 80% | `npm run test -- --coverage` |
| 类型检查 | 无错误 | `npm run build` |
| 代码审查 | 通过 | `code-reviewer` agent |

## 安全护栏

- ✅ 自动 commit（本地）
- ❌ 自动 push（需确认）
- ✅ 最大尝试次数限制
- ✅ 超时保护
- ❌ 阻止危险命令

## 配置选项

编辑 `.claude/scripts/autonomous-loop.ts`:

```typescript
const CONFIG = {
  backendDir: 'hq/backend',
  maxAttempts: 5,              // 最大尝试次数
  coverageThreshold: 80,       // 覆盖率阈值
  branchPrefix: 'auto-fix/',   // 分支前缀
}
```

## 使用场景

### 1. 自动修复 CI 失败

```bash
# CI 失败后
git checkout -b fix/ci-failure
/auto-fix
# 循环会自动修复直到所有测试通过
```

### 2. 批量修复已知问题

```bash
# 创建修复任务列表
echo "test-1" >> .claude/state/fix-queue.txt
echo "test-2" >> .claude/state/fix-queue.txt
/auto-fix
```

### 3. 持续监控（开发中）

```bash
# 设置监控循环（每 5 分钟）
/loop 5m /auto-fix
```

## 监控状态

```bash
# 查看修复历史
cat .claude/state/fix-history.json

# 查看摘要
cat .claude/state/summary.md

# 查看日志
cat .claude/logs/auto-fix-*.log
```

## 故障排除

### 卡在某个测试

```bash
# 查看当前状态
/auto-status

# 手动跳过
echo "skip" > .claude/state/skip-current.txt
```

### 重置循环

```bash
# 清理状态
rm -rf .claude/state/*
rm -rf .claude/logs/*
```

## 与 CI/CD 集成

```yaml
# .github/workflows/auto-fix.yml
name: Auto Fix
on:
  workflow_run:
    workflows: ["Tests"]
    types: [completed]

jobs:
  auto-fix:
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run auto-fix loop
        run: npx ts-node .claude/scripts/autonomous-loop.ts
```

## 贡献

改进欢迎！提交 PR 到 `.claude/scripts/`。
