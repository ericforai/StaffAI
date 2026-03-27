#!/usr/bin/env node
/**
 * fix.js - 自动化修复 CLI (JavaScript 版本)
 *
 * 用法:
 *   node .claude/scripts/fix.js           # 运行修复循环
 *   node .claude/scripts/fix.js status    # 查看状态
 *   node .claude/scripts/fix.js reset     # 重置状态
 *   node .claude/scripts/fix.js history   # 查看历史
 */

const { execSync } = require('child_process')
const { readFileSync, existsSync, writeFileSync, unlinkSync, readdirSync, mkdirSync } = require('fs')
const { join } = require('path')

const PROJECT_DIR = process.cwd()
const STATE_DIR = join(PROJECT_DIR, '.claude/state')
const HISTORY_FILE = join(STATE_DIR, 'fix-history.json')

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function color(str, c) {
  return `${colors[c] || colors.reset}${str}${colors.reset}`
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function runTests() {
  console.log(color('▶ 运行测试...', 'blue'))
  try {
    const output = execSync('npm run test', {
      cwd: join(PROJECT_DIR, 'hq/backend'),
      encoding: 'utf-8',
      stdio: 'pipe'
    })
    const passed = !output.includes('tests? failed') && !output.includes('FAIL')
    return { passed, output }
  } catch (error) {
    return {
      passed: false,
      output: error.stdout || error.message || ''
    }
  }
}

function showStatus() {
  console.log(color('\n=== 修复状态 ===', 'blue'))

  // 测试状态
  const testResult = runTests()
  if (testResult.passed) {
    console.log(color('✅ 所有测试通过', 'green'))
  } else {
    console.log(color('❌ 存在失败的测试', 'red'))

    // 提取失败测试
    const lines = testResult.output.split('\n')
    const failures = lines.filter(line =>
      line.includes('FAIL') && line.includes('.test.')
    ).slice(0, 10)

    if (failures.length > 0) {
      console.log(color('\n失败的测试:', 'yellow'))
      failures.forEach(f => console.log(`  - ${f.trim()}`))
    }
  }

  // 当前任务
  ensureDir(STATE_DIR)
  const taskFiles = readdirSync(STATE_DIR)
    .filter(f => f.startsWith('fix-task-') && f.endsWith('.md'))
    .sort()

  if (taskFiles.length > 0) {
    const latestTask = taskFiles[taskFiles.length - 1]
    console.log(color(`\n📋 当前任务: ${latestTask}`, 'yellow'))
  }

  // 分支状态
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim()
    if (branch.startsWith('auto-fix/')) {
      console.log(color(`\n🌿 自动修复分支: ${branch}`, 'yellow'))
    }
  } catch (e) {
    // Git 不可用，忽略
  }
}

function showHistory() {
  console.log(color('\n=== 修复历史 ===', 'blue'))

  if (!existsSync(HISTORY_FILE)) {
    console.log(color('暂无修复历史', 'yellow'))
    return
  }

  const history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))

  console.log('\n尝试次数:', history.length)
  console.log()

  history.forEach(attempt => {
    const status = attempt.testResult?.passed ?
      color('✅ 通过', 'green') :
      color(`❌ ${attempt.testResult?.failedTests?.length || 0} 失败`, 'red')

    console.log(`尝试 #${attempt.attemptNumber}: ${status}`)
    console.log(`  修复: ${attempt.fixDescription || 'N/A'}`)
    console.log(`  审查: ${attempt.codeReviewPassed ? '✅' : '❌'}`)
    console.log(`  时间: ${attempt.timestamp || 'N/A'}`)
    console.log()
  })
}

function resetState() {
  console.log(color('⚠️  重置所有状态...', 'yellow'))

  ensureDir(STATE_DIR)
  const files = readdirSync(STATE_DIR)
  let deleted = 0

  for (const file of files) {
    if (file.startsWith('fix-') || file === 'summary.md') {
      try {
        unlinkSync(join(STATE_DIR, file))
        deleted++
      } catch (e) {
        // 忽略删除错误
      }
    }
  }

  console.log(color(`\n✅ 已删除 ${deleted} 个状态文件`, 'green'))
}

function runFixLoop() {
  console.log(color('\n=== 自动修复循环 ===', 'blue'))

  ensureDir(STATE_DIR)

  let attempt = 0
  const maxAttempts = 3

  while (attempt < maxAttempts) {
    attempt++
    console.log(color(`\n--- 尝试 ${attempt}/${maxAttempts} ---`, 'blue'))

    const testResult = runTests()

    if (testResult.passed) {
      console.log(color('\n✅ 所有测试通过！修复完成。', 'green'))

      // 保存成功记录
      const history = existsSync(HISTORY_FILE) ?
        JSON.parse(readFileSync(HISTORY_FILE, 'utf-8')) : []

      history.push({
        attemptNumber: attempt,
        timestamp: new Date().toISOString(),
        testResult: { passed: true, failedTests: [] },
        fixDescription: '自动化修复',
        codeReviewPassed: true
      })

      writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
      return
    }

    console.log(color('❌ 测试失败', 'red'))

    // 提取失败测试
    const lines = testResult.output.split('\n')
    const failures = lines.filter(line =>
      line.includes('FAIL') && line.includes('.test.')
    ).slice(0, 5)

    if (failures.length > 0) {
      console.log(color('\n需要修复的测试:', 'yellow'))
      failures.forEach(f => console.log(`  - ${f.trim()}`))
    }

    // 生成修复任务
    const taskContent = `# 修复任务 #${attempt}

## 失败的测试

${failures.map(f => `- ${f.trim()}`).join('\n')}

## 下一步

请 Claude Code 分析并修复这些测试：

1. 阅读失败的测试代码
2. 找出根本原因
3. 实施最小化修复
4. 验证所有测试通过

运行此命令继续: node .claude/scripts/fix.js
`

    writeFileSync(join(STATE_DIR, `fix-task-${attempt}.md`), taskContent)
    console.log(color(`\n📋 修复任务已生成: .claude/state/fix-task-${attempt}.md`, 'yellow'))

    console.log(color('\n⏸️  等待修复完成后重新运行此脚本', 'yellow'))
    return
  }

  console.log(color('\n❌ 达到最大尝试次数，需要人工介入', 'red'))
}

function showHelp() {
  console.log(color('\n=== 自动修复 CLI ===', 'blue'))
  console.log('\n用法:')
  console.log('  node .claude/scripts/fix.js <命令>\n')
  console.log('命令:')
  console.log('  run     运行完整修复循环')
  console.log('  status  查看当前状态')
  console.log('  reset   重置所有状态')
  console.log('  history 查看修复历史')
  console.log('  help    显示帮助')
  console.log()
}

// Main
const command = process.argv[2] || 'run'

switch (command) {
  case 'run':
    runFixLoop()
    break
  case 'status':
    showStatus()
    break
  case 'reset':
    resetState()
    break
  case 'history':
    showHistory()
    break
  case 'help':
  default:
    showHelp()
}
