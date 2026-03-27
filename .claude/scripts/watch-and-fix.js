#!/usr/bin/env node
/**
 * watch-and-fix.js - 文件监听 + 自动修复
 *
 * 监听代码变化，自动运行测试和修复
 */

const { execSync } = require('child_process')
const { watch } = require('chokidar')
const { join } = require('path')
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs')

const PROJECT_DIR = process.cwd()
const BACKEND_DIR = join(PROJECT_DIR, 'hq/backend')
const STATE_DIR = join(PROJECT_DIR, '.claude/state')

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
}

function color(str, c) {
  return `${colors[c]}${str}${colors.reset}`
}

function log(msg, level = 'info') {
  const timestamp = new Date().toLocaleTimeString()
  const c = { info: 'cyan', success: 'green', warning: 'yellow', error: 'red' }[level] || 'reset'
  console.log(color(`[${timestamp}] ${msg}`, c))
}

// 防抖：避免频繁触发
let debounceTimer = null
const DEBOUNCE_MS = 2000 // 2秒后触发

// 忽略的文件/目录
const IGNORED = [
  /node_modules/,
  /dist/,
  /\.git/,
  /coverage/,
  /\.claude/,
  /\.DS_Store/,
  /\.log$/,
  /\.test\.ts$/ // 测试文件变化不触发
]

// 监听的路径
const WATCH_PATHS = [
  join(BACKEND_DIR, 'src/**/*.ts'),
  `!${join(BACKEND_DIR, 'src/**/*.test.ts')}`
]

function runTests() {
  try {
    const output = execSync('npm run test', {
      cwd: BACKEND_DIR,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000 // 60秒超时
    })
    return { passed: !output.includes('FAIL'), output }
  } catch (error) {
    return { passed: false, output: error.stdout || '' }
  }
}

function extractFailures(output) {
  const lines = output.split('\n')
  return lines
    .filter(line => line.includes('FAIL') && line.includes('.test.'))
    .slice(0, 5)
    .map(f => f.trim())
}

function createFixTask(attempt, failures) {
  const timestamp = new Date().toISOString()
  const taskContent = `# 自动修复任务

生成时间: ${timestamp}
尝试次数: ${attempt}

## 失败的测试 (${failures.length})

${failures.map(f => `- ${f}`).join('\n')}

## 触发原因

文件变化后测试失败，自动触发修复流程。

## 下一步

Claude Code 将自动：
1. 分析失败原因
2. 修复代码
3. 验证修复

运行状态查看: \`npm run auto-fix:status\`
`

  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(join(STATE_DIR, `fix-task-${Date.now()}.md`), taskContent)
}

function handleFileChange(path) {
  log(`文件变化: ${path.replace(PROJECT_DIR, '')}`, 'info')

  // 防抖
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    log('运行测试...', 'info')

    const result = runTests()

    if (result.passed) {
      log('✅ 所有测试通过', 'success')
    } else {
      const failures = extractFailures(result.output)
      log(`❌ 检测到 ${failures.length} 个失败测试`, 'error')

      failures.forEach(f => log(`  - ${f}`, 'error'))

      // 创建修复任务
      createFixTask(1, failures)
      log('修复任务已生成，等待处理...', 'warning')
    }
  }, DEBOUNCE_MS)
}

function showHeader() {
  console.log(color('╔════════════════════════════════════════════════════════════════╗', 'cyan'))
  console.log(color('║          文件监听 + 自动修复 - 运行中                         ║', 'cyan'))
  console.log(color('╚════════════════════════════════════════════════════════════════╝', 'cyan'))
  console.log()
  log('监听目录: hq/backend/src')
  log('防抖延迟: 2秒')
  log('按 Ctrl+C 停止')
  console.log()
}

function main() {
  showHeader()

  // 初始测试
  log('运行初始测试...', 'info')
  const initialResult = runTests()
  if (initialResult.passed) {
    log('✅ 初始测试通过', 'success')
  } else {
    const failures = extractFailures(initialResult.output)
    log(`⚠️  初始测试发现 ${failures.length} 个失败`, 'warning')
  }

  // 启动监听
  const watcher = watch(join(BACKEND_DIR, 'src'), {
    ignored: IGNORED,
    persistent: true,
    ignoreInitial: true
  })

  watcher
    .on('add', path => handleFileChange(path))
    .on('change', path => handleFileChange(path))
    .on('unlink', path => handleFileChange(path))
    .on('error', error => log(`监听错误: ${error}`, 'error'))

  // 优雅退出
  process.on('SIGINT', () => {
    log('\n停止监听...', 'info')
    watcher.close()
    process.exit(0)
  })
}

main()
