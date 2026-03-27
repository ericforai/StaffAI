#!/usr/bin/env node
/**
 * demo-fix.js - 自动修复演示版本（快速模式）
 *
 * 这是一个演示版本，不需要实际运行测试，展示工作流程
 */

const { writeFileSync, existsSync, mkdirSync, readFileSync } = require('fs')
const { join } = require('path')

const PROJECT_DIR = process.cwd()
const STATE_DIR = join(PROJECT_DIR, '.claude/state')
const HISTORY_FILE = join(STATE_DIR, 'fix-history.json')

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

function showHeader() {
  console.clear()
  console.log(color('╔════════════════════════════════════════════════════════════════╗', 'cyan'))
  console.log(color('║           自动化测试修复系统 - 演示模式                        ║', 'cyan'))
  console.log(color('╚════════════════════════════════════════════════════════════════╝', 'cyan'))
  console.log()
}

function showWorkflow() {
  console.log(color('工作流程:', 'blue'))
  console.log()

  const steps = [
    { num: 1, name: '运行测试', desc: '执行 npm run test' },
    { num: 2, name: '分析失败', desc: '解析测试输出，识别失败' },
    { num: 3, name: '生成任务', desc: '创建修复任务文件' },
    { num: 4, name: '执行修复', desc: 'Claude Code 分析并修复' },
    { num: 5, name: '验证修复', desc: '重新运行测试确认' },
    { num: 6, name: '自动提交', desc: 'Git commit 修复' }
  ]

  steps.forEach(step => {
    console.log(color(`  ${step.num}. ${step.name.padEnd(10)} - ${step.desc}`, 'white'))
  })

  console.log()
}

function showQualityGates() {
  console.log(color('质量门禁:', 'blue'))
  console.log()

  const gates = [
    { name: '测试通过', status: '✅', desc: '所有测试必须 100% 通过' },
    { name: '类型检查', status: '✅', desc: 'TypeScript 编译无错误' },
    { name: '代码覆盖', status: '✅', desc: '覆盖率 >= 80%' },
    { name: '代码审查', status: '✅', desc: '通过 code-reviewer 检查' }
  ]

  gates.forEach(gate => {
    const statusColor = gate.status === '✅' ? 'green' : 'red'
    console.log(`  ${color(gate.status, statusColor)} ${color(gate.name.padEnd(10), 'white')} - ${gate.desc}`)
  })

  console.log()
}

function showSafetyRails() {
  console.log(color('安全护栏:', 'blue'))
  console.log()

  const rails = [
    { name: '自动提交', value: '✅ 本地 git commit' },
    { name: '自动推送', value: '❌ 需要确认' },
    { name: '最大尝试', value: '5 次' },
    { name: '超时保护', value: '5 分钟' },
    { name: '危险命令', value: '❌ 已阻止' }
  ]

  rails.forEach(rail => {
    console.log(`  ${rail.value.padEnd(20)} ${color(rail.name, 'white')}`)
  })

  console.log()
}

function showCommands() {
  console.log(color('可用命令:', 'blue'))
  console.log()

  const commands = [
    { cmd: 'npm run auto-fix', desc: '运行完整修复循环' },
    { cmd: 'npm run auto-fix:status', desc: '查看当前状态' },
    { cmd: 'npm run auto-fix:history', desc: '查看修复历史' },
    { cmd: 'npm run auto-fix:reset', desc: '重置所有状态' }
  ]

  commands.forEach(c => {
    console.log(color(`  ${c.cmd.padEnd(30)}`, 'cyan') + c.desc)
  })

  console.log()
}

function showFileStructure() {
  console.log(color('文件结构:', 'blue'))
  console.log()

  const files = [
    '.claude/',
    '  scripts/',
    '    fix.js                    # 主要 CLI',
    '    autonomous-loop.ts        # 高级循环',
    '    auto-fix-loop.sh          # Bash 版本',
    '  agents/',
    '    auto-fixer.md             # 修复 agent',
    '  config/',
    '    auto-fix.json             # 权限配置',
    '  state/',
    '    fix-task-N.md             # 修复任务',
    '    fix-history.json          # 历史记录',
    '  logs/',
    '    auto-fix-*.log            # 运行日志'
  ]

  files.forEach(f => {
    const colorCode = f.includes('.md') || f.includes('.json') ? 'cyan' : 'white'
    console.log(color(`  ${f}`, colorCode))
  })

  console.log()
}

function showExample() {
  console.log(color('使用示例:', 'blue'))
  console.log()

  const example = [
    '$ cd hq/backend',
    '$ npm run auto-fix',
    '',
    color('  ═════════════════════════════════════', 'cyan'),
    color('  === 自动修复循环 ===', 'blue'),
    color('  --- 尝试 1/3 ---', 'blue'),
    color('  ▶ 运行测试...', 'blue'),
    color('  ❌ 检测到 2 个失败测试', 'red'),
    color('  📋 修复任务已生成', 'yellow'),
    color('  ⏸️  等待修复完成后重新运行', 'yellow'),
    color('  ═════════════════════════════════════', 'cyan'),
    '',
    '# 此时让 Claude Code 处理修复任务',
    '# 修复完成后再次运行',
    '',
    '$ npm run auto-fix',
    '',
    color('  ═════════════════════════════════════', 'cyan'),
    color('  === 自动修复循环 ===', 'blue'),
    color('  --- 尝试 2/3 ---', 'blue'),
    color('  ▶ 运行测试...', 'blue'),
    color('  ✅ 所有测试通过！', 'green'),
    color('  ═════════════════════════════════════', 'cyan')
  ]

  example.forEach(line => console.log(`  ${line}`))
  console.log()
}

function showIntegrations() {
  console.log(color('集成选项:', 'blue'))
  console.log()

  const integrations = [
    { name: 'CI/CD', desc: '自动修复失败的 CI 构建' },
    { name: 'Git Hooks', desc: '提交前自动修复' },
    { name: '/loop 命令', desc: '持续监控模式' },
    { name: 'GitHub Actions', desc: '自动创建 PR' }
  ]

  integrations.forEach(i => {
    console.log(`  • ${color(i.name.padEnd(15), 'cyan')} - ${i.desc}`)
  })

  console.log()
}

function main() {
  showHeader()
  showWorkflow()
  showQualityGates()
  showSafetyRails()
  showCommands()
  showFileStructure()
  showExample()
  showIntegrations()

  console.log(color('════════════════════════════════════════════════════════════════', 'cyan'))
  console.log(color('准备就绪！运行 "npm run auto-fix" 开始自动修复', 'green'))
  console.log(color('════════════════════════════════════════════════════════════════', 'cyan'))
}

main()
