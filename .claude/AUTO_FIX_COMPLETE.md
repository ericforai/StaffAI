# 自动化测试修复系统 - 完整指南

## ✅ 已配置的自动化

### 1. 保存时触发 (文件监听)

```bash
cd hq/backend && npm run watch:fix
```

**工作方式:**
- 监听 `src/` 目录下的 `.ts` 文件
- 文件保存后 2 秒自动运行测试
- 测试失败时生成修复任务

### 2. Commit 前验证 (Git Hook)

```bash
git commit -m "your message"
```

**工作方式:**
- 每次 commit 前自动运行测试
- 测试失败时**阻止提交**
- 提示修复选项

## 快速命令

| 命令 | 用途 |
|------|------|
| `npm run watch:fix` | 启动文件监听 + 自动测试 |
| `npm run auto-fix` | 手动运行修复循环 |
| `npm run auto-fix:status` | 查看修复状态 |
| `npm run auto-fix:history` | 查看修复历史 |
| `npm run auto-fix:reset` | 重置状态 |

## 工作流程

### 开发时 (推荐)

```bash
# 终端 1: 启动文件监听
cd hq/backend && npm run watch:fix

# 终端 2: 正常开发
# 修改代码...保存后自动测试
```

### 提交时

```bash
# 修改代码
git add .

# 尝试提交 (自动测试)
git commit -m "feat: add feature"

# 如果测试失败:
# 1. 修复问题
# 2. 或运行 npm run auto-fix
# 3. 再次提交
```

## 自动化级别

| 触发方式 | 自动化程度 | 状态 |
|---------|----------|------|
| 保存文件 | ⭐⭐⭐⭐⭐ | ✅ 已启用 |
| Git commit | ⭐⭐⭐⭐ | ✅ 已启用 |
| 定期检查 | ⭐⭐⭐ | 可选 (`/loop`) |
| 手动触发 | ⭐ | 可用 |

## 配置文件

```
.claude/
├── scripts/
│   ├── fix.js                    # 手动修复 CLI
│   ├── watch-and-fix.js          # 文件监听
│   └── setup-automation.sh       # 安装脚本
├── .githooks/
│   └── pre-commit                # Git hook
└── config/
    └── auto-fix.json             # 配置
```

## 自定义配置

### 修改防抖延迟

编辑 `.claude/scripts/watch-and-fix.js`:

```javascript
const DEBOUNCE_MS = 2000 // 改为你想要的毫秒数
```

### 跳过 commit 检查

```bash
git commit --no-verify -m "message"
```

### 禁用文件监听

```bash
# 按 Ctrl+C 停止
```

## 故障排除

### 文件监听不工作

```bash
# 检查 chokidar 是否安装
cd hq/backend && npm list chokidar

# 如果没有，安装它
npm install chokidar
```

### Git hook 不执行

```bash
# 检查 hook 路径
git config core.hooksPath
# 应该输出: .githooks

# 重新配置
git config core.hooksPath .githooks
```

### 测试超时

编辑 `.claude/scripts/watch-and-fix.js`:

```javascript
timeout: 120000 // 增加到 120 秒
```

## 重新安装

```bash
bash .claude/scripts/setup-automation.sh
```

---

**状态**: ✅ 完全自动化已启用
**版本**: 2.0.0
**日期**: 2026-03-27
