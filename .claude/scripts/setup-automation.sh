#!/bin/bash
#
# setup-automation.sh - 自动化系统安装脚本
#
# 配置:
# 1. 文件保存时自动运行测试
# 2. Git commit 前验证测试
#

set -euo pipefail

PROJECT_DIR="$(pwd)"
HOOKS_DIR="$PROJECT_DIR/.githooks"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         自动化测试修复系统 - 安装程序                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 1. 检查依赖
echo "🔍 检查依赖..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装"
    exit 1
fi

echo "✅ 依赖检查通过"
echo ""

# 2. 配置 Git hooks
echo "🔧 配置 Git hooks..."

if [ -f "$HOOKS_DIR/pre-commit" ]; then
    chmod +x "$HOOKS_DIR/pre-commit"
    git config core.hooksPath "$HOOKS_DIR"
    echo "✅ Git pre-commit hook 已启用"
else
    echo "⚠️  未找到 pre-commit hook，跳过..."
fi

echo ""

# 3. 创建状态目录
echo "📁 创建状态目录..."

mkdir -p "$PROJECT_DIR/.claude/state"
mkdir -p "$PROJECT_DIR/.claude/logs"

echo "✅ 目录已创建"
echo ""

# 4. 验证安装
echo "🧪 验证安装..."

if [ -f "$PROJECT_DIR/.claude/scripts/fix.js" ]; then
    echo "✅ fix.js 脚本存在"
else
    echo "❌ fix.js 脚本缺失"
    exit 1
fi

if [ -f "$PROJECT_DIR/.claude/scripts/watch-and-fix.js" ]; then
    echo "✅ watch-and-fix.js 脚本存在"
else
    echo "❌ watch-and-fix.js 脚本缺失"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ 安装完成！                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "可用命令:"
echo ""
echo "  📝 保存时触发:"
echo "    cd hq/backend && npm run watch:fix"
echo ""
echo "  🔍 手动修复:"
echo "    cd hq/backend && npm run auto-fix"
echo ""
echo "  📊 查看状态:"
echo "    cd hq/backend && npm run auto-fix:status"
echo ""
echo "  ⚙️  Commit 验证:"
echo "    自动启用 - 每次提交前运行测试"
echo ""
echo "配置文件:"
echo "  • Git hooks: .githooks/pre-commit"
echo "  • 配置:      .claude/config/auto-fix.json"
echo ""
