#!/usr/bin/env -S npx ts-node
/**
 * autonomous-loop.ts
 *
 * 完全自主的测试驱动修复循环
 *
 * 工作流程:
 * 1. 运行测试
 * 2. 检测失败
 * 3. 调用 auto-fixer agent 修复
 * 4. 运行 code-reviewer 验证
 * 5. 自动提交 + PR
 * 6. 重复直到所有测试通过
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

interface TestResult {
  passed: boolean
  failedTests: string[]
  output: string
}

interface FixAttempt {
  attemptNumber: number
  testResult: TestResult
  fixDescription: string
  codeReviewPassed: boolean
}

const CONFIG = {
  backendDir: join(process.cwd(), 'hq/backend'),
  maxAttempts: 5,
  coverageThreshold: 80,
  branchPrefix: 'auto-fix/',
  stateDir: join(process.cwd(), '.claude/state'),
  logDir: join(process.cwd(), '.claude/logs'),
}

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  const timestamp = new Date().toISOString()
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`)
}

function ensureDirs() {
  if (!existsSync(CONFIG.stateDir)) mkdirSync(CONFIG.stateDir, { recursive: true })
  if (!existsSync(CONFIG.logDir)) mkdirSync(CONFIG.logDir, { recursive: true })
}

function runTests(): TestResult {
  log('运行测试套件...', 'blue')

  try {
    const output = execSync(
      'npm run test',
      { cwd: CONFIG.backendDir, encoding: 'utf-8', stdio: 'pipe' }
    )

    // 解析输出
    const passed = !output.includes('tests? failed') && !output.includes('FAIL')

    const failedTests: string[] = []
    if (!passed) {
      const lines = output.split('\n')
      for (const line of lines) {
        if (line.includes('FAIL') && line.includes('.test.')) {
          failedTests.push(line.trim())
        }
      }
    }

    return { passed, failedTests, output }
  } catch (error: any) {
    return {
      passed: false,
      failedTests: [],
      output: error.stdout || error.message || 'Unknown error'
    }
  }
}

function extractFailContext(testResult: TestResult): string {
  const { failedTests, output } = testResult

  let context = `# 测试失败摘要\n\n`
  context += `## 失败的测试 (${failedTests.length})\n\n`

  for (const test of failedTests) {
    context += `- ${test}\n`
  }

  context += `\n## 详细输出\n\n\`\`\`\n${output}\n\`\`\`\n`

  return context
}

function writeFixTask(attemptNumber: number, testResult: TestResult) {
  const context = extractFailContext(testResult)

  const taskContent = `# 自动修复任务 #${attemptNumber}

${context}

## 修复要求

1. **根本原因分析**: 阅读失败的测试代码和实现代码
2. **最小化修复**: 只修改必要的代码
3. **验证所有测试**: 修复后运行完整测试套件
4. **代码审查**: 修复必须通过 code-reviewer 检查

## 质量门禁

- 所有测试通过: \`npm run test\`
- 覆盖率 >= ${CONFIG.coverageThreshold}%
- 无 TypeScript 错误: \`npm run build\`
- 无 lint 错误

## 当前状态

- 尝试次数: ${attemptNumber} / ${CONFIG.maxAttempts}
- 失败测试数: ${testResult.failedTests.length}
- 自动化分支: ${CONFIG.branchPrefix}attempt-${attemptNumber}
`

  writeFileSync(
    join(CONFIG.stateDir, `fix-task-${attemptNumber}.md`),
    taskContent
  )

  log(`修复任务已生成: .claude/state/fix-task-${attemptNumber}.md`, 'blue')
  return taskContent
}

function createBranch(attemptNumber: number) {
  const branchName = `${CONFIG.branchPrefix}attempt-${attemptNumber}`

  try {
    // 检查分支是否存在
    execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'pipe' })
    // 分支存在，切换过去
    execSync(`git checkout ${branchName}`, { stdio: 'pipe' })
  } catch {
    // 分支不存在，创建新分支
    execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' })
  }

  log(`使用分支: ${branchName}`, 'blue')
  return branchName
}

function commitFix(attemptNumber: number, description: string) {
  try {
    // 检查是否有变更
    const status = execSync('git status --porcelain', { encoding: 'utf-8' })
    if (!status.trim()) {
      log('没有检测到代码变更', 'yellow')
      return false
    }

    execSync('git add -A', { stdio: 'pipe' })
    execSync(
      `git commit -m "fix: auto-fix attempt ${attemptNumber} - ${description}"`,
      { stdio: 'pipe' }
    )

    log('✅ 代码已提交', 'green')
    return true
  } catch (error: any) {
    log(`提交失败: ${error.message}`, 'red')
    return false
  }
}

function saveAttempt(attempt: FixAttempt) {
  const historyFile = join(CONFIG.stateDir, 'fix-history.json')

  let history: FixAttempt[] = []
  if (existsSync(historyFile)) {
    history = JSON.parse(readFileSync(historyFile, 'utf-8'))
  }

  history.push(attempt)
  writeFileSync(historyFile, JSON.stringify(history, null, 2))
}

function writeSummary(attempts: FixAttempt[], finalResult: TestResult) {
  const summary = `# 自动修复循环摘要

生成时间: ${new Date().toISOString()}

## 最终结果

${finalResult.passed ? '✅ 所有测试通过' : `❌ 仍有 ${finalResult.failedTests.length} 个测试失败`}

## 修复尝试 (${attempts.length})

| 尝试 | 失败测试数 | 修复描述 | 代码审查 |
|-----|----------|---------|---------|
${attempts.map(a =>
  `| ${a.attemptNumber} | ${a.testResult.failedTests.length} | ${a.fixDescription} | ${a.codeReviewPassed ? '✅' : '❌' }`
).join('\n')}

## 下一步

${finalResult.passed
  ? '1. 代码已准备好提交\n2. 可以创建 PR'
  : '1. 需要人工介入\n2. 查看 .claude/state/fix-history.json 了解详情'
}
`

  writeFileSync(join(CONFIG.stateDir, 'summary.md'), summary)
  log(summary, finalResult.passed ? 'green' : 'yellow')
}

async function main() {
  log('=== 自主修复循环启动 ===', 'blue')
  ensureDirs()

  const attempts: FixAttempt[] = []

  for (let i = 1; i <= CONFIG.maxAttempts; i++) {
    log(`\n--- 尝试 ${i}/${CONFIG.maxAttempts} ---`, 'blue')

    // 1. 运行测试
    const testResult = runTests()

    if (testResult.passed) {
      log('✅ 所有测试通过！', 'green')
      writeSummary(attempts, testResult)
      process.exit(0)
    }

    log(`❌ 检测到 ${testResult.failedTests.length} 个失败测试`, 'red')

    // 2. 创建修复分支
    createBranch(i)

    // 3. 写入修复任务
    const taskContent = writeFixTask(i, testResult)

    // 4. 等待修复完成（由 Claude Code 处理）
    log('\n=== 等待修复 ===', 'yellow')
    log('修复任务已生成，请让 Claude Code 处理:', 'yellow')
    log(`  .claude/state/fix-task-${i}.md`, 'yellow')
    log('\n处理完成后，重新运行此脚本继续。', 'yellow')

    // 保存当前状态
    saveAttempt({
      attemptNumber: i,
      testResult,
      fixDescription: '待处理',
      codeReviewPassed: false
    })

    break // 等待人工/agent 介入
  }

  writeSummary(attempts, runTests())
}

main().catch(error => {
  log(`错误: ${error.message}`, 'red')
  process.exit(1)
})
