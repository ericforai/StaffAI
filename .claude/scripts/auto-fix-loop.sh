#!/bin/bash
#
# auto-fix-loop.sh
# 测试驱动的自动化修复循环
#
# 工作流程:
# 1. 运行测试
# 2. 如果有失败，分析并修复
# 3. 再次验证
# 4. 自动提交 + PR
# 5. 质量门禁检查
#

set -euo pipefail

# 配置
BACKEND_DIR="${PROJECT_DIR}/hq/backend"
MAX_FIX_ATTEMPTS=3
COVERAGE_THRESHOLD=80
BRANCH_PREFIX="auto-fix/"
LOG_FILE="${PROJECT_DIR}/.claude/logs/auto-fix-$(date +%Y%m%d-%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

info() { log "ℹ️  $1"; }
success() { log "✅ $1"; }
error() { log "❌ $1"; }
warn() { log "⚠️  $1"; }

# 检查测试是否通过
run_tests() {
    info "运行测试..."
    cd "$BACKEND_DIR"

    if npm run test 2>&1 | tee -a "$LOG_FILE" | grep -q "tests? failed"; then
        return 1
    fi
    return 0
}

# 分析失败的测试
analyze_failures() {
    info "分析失败的测试..."

    # 从测试输出中提取失败信息
    local failed_tests=$(node --test --test-concurrency=1 dist/**/*.test.js 2>&1 | \
        grep -oE "FAIL.*test.*" | \
        head -20)

    echo "$failed_tests" > "${PROJECT_DIR}/.claude/state/failed-tests.txt"
    echo "$failed_tests"
}

# 主循环
main() {
    info "=== 自动修复循环开始 ==="

    mkdir -p "${PROJECT_DIR}/.claude/logs"
    mkdir -p "${PROJECT_DIR}/.claude/state"

    # 1. 运行测试
    if run_tests; then
        success "所有测试通过！无需修复。"
        return 0
    fi

    error "检测到测试失败，开始修复流程..."

    # 2. 分析失败
    local failed_tests=$(analyze_failures)
    warn "失败的测试:\n$failed_tests"

    # 3. 生成修复任务
    cat > "${PROJECT_DIR}/.claude/state/fix-task.md" <<EOF
# 自动修复任务

## 失败的测试
\`\`\`
$failed_tests
\`\`\`

## 修复要求
1. 分析测试失败的根本原因
2. 修改代码使测试通过
3. 确保修复不破坏其他测试
4. 保持代码质量标准

## 质量门禁
- 所有测试必须通过
- 覆盖率 >= ${COVERAGE_THRESHOLD}%
- 代码符合 TypeScript 严格模式
EOF

    info "修复任务已生成: .claude/state/fix-task.md"
    info "请 Claude Code 处理修复任务，完成后再次运行此脚本。"

    return 1
}

main "$@"
