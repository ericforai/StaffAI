---
name: auto-fix-loop
description: 运行测试驱动的自动化修复循环 - 检测失败、自动修复、验证提交
---

# 自动修复循环

此技能运行测试驱动的自动化修复流程。

## 触发方式

- `/auto-fix` - 运行完整修复循环
- `/auto-fast` - 快速模式（单次修复尝试）
- `/auto-status` - 查看修复状态

## 工作流程

### 1. 检测阶段
```bash
cd hq/backend && npm run test
```

### 2. 分析阶段
- 解析测试输出
- 识别失败的测试
- 提取错误信息

### 3. 修复阶段
- 调用 `auto-fixer` agent
- 最小化修复代码
- 保持架构一致性

### 4. 验证阶段
- 重新运行所有测试
- 检查覆盖率（目标 80%+）
- 运行 code review

### 5. 提交阶段
- 自动 commit
- 可选：创建 PR

## 配置

编辑 `.claude/scripts/autonomous-loop.ts` 中的配置：

```typescript
const CONFIG = {
  maxAttempts: 5,           // 最大修复尝试次数
  coverageThreshold: 80,    // 覆盖率阈值
  branchPrefix: 'auto-fix/', // 分支前缀
}
```

## 质量门禁

修复必须满足：
- [ ] 所有测试通过
- [ ] 覆盖率 >= 80%
- [ ] 无 TypeScript 错误
- [ ] Code review 通过

## 使用示例

```bash
# 完整循环
/auto-fix

# 快速修复
/auto-fast

# 查看状态
/auto-status
```
