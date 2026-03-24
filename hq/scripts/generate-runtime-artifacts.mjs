#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const hqDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(hqDir, '..');
const manifestPath = path.join(hqDir, 'config', 'host-manifest.json');
const generatedDir = path.join(hqDir, 'generated');
const hostsDir = path.join(generatedDir, 'hosts');
const registryDir = path.join(generatedDir, 'registry');

const agentDirs = [
  'design',
  'engineering',
  'game-development',
  'marketing',
  'paid-media',
  'product',
  'project-management',
  'testing',
  'support',
  'spatial-computing',
  'specialized',
];

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, payload) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

function writeFile(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function walkMarkdownFiles(startDir) {
  if (!fs.existsSync(startDir)) {
    return [];
  }

  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') {
      files.push(fullPath);
    }
  }

  return files;
}

function getFrontmatterValue(content, field) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const pattern = new RegExp(`^${field}:\\s*(.*)$`, 'm');
  const match = frontmatterMatch[1].match(pattern);
  return match ? match[1].trim() : null;
}

function collectAgents() {
  const agents = [];

  for (const dir of agentDirs) {
    const files = walkMarkdownFiles(path.join(repoRoot, dir));
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const name = getFrontmatterValue(content, 'name') || path.basename(filePath, '.md');
      const description = getFrontmatterValue(content, 'description') || 'No description provided.';
      agents.push({
        id: slugify(name),
        name,
        description,
        department: dir,
        filePath,
      });
    }
  }

  return agents.sort((left, right) => left.name.localeCompare(right.name));
}

function createCapabilities() {
  return [
    'discussion.orchestrate',
    'discussion.consult',
    'host.inject',
    'agent.discover',
    'skill.discover',
    'executor.claude',
    'executor.codex',
    'executor.openai',
    'workflow.recommend',
  ];
}

function createRecommendationTemplates() {
  return [
    { stage: 'brainstorm', actions: ['hire_experts', 'inspect_host_injection'] },
    { stage: 'review', actions: ['run_expert_discussion', 'inspect_host_injection'] },
    { stage: 'debug', actions: ['switch_to_serial', 'fallback_to_web_ui'] },
    { stage: 'ship', actions: ['run_expert_discussion', 'inspect_host_injection'] },
    { stage: 'consult', actions: ['hire_experts', 'run_expert_discussion'] },
  ];
}

function renderSnippet(host, project) {
  return [
    `## ${host.instructionTitle}`,
    '',
    'Use The Agency HQ as the runtime source of truth for multi-agent orchestration.',
    `- Web UI: ${project.webUrl}`,
    `- API: ${project.apiUrl}`,
    `- State dir: ${project.stateDir}`,
    `- MCP entry: ${project.mcpEntry}`,
    '',
    `Host: ${host.label}`,
    `Capability level: ${host.capabilityLevel}`,
    `Fallback: ${host.degradation.manualFallback}`,
  ].join('\n');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const agents = collectAgents();
const capabilities = createCapabilities();
const recommendationTemplates = createRecommendationTemplates();

fs.rmSync(generatedDir, { recursive: true, force: true });
mkdirp(hostsDir);
mkdirp(registryDir);

for (const host of manifest.hosts) {
  const hostDir = path.join(hostsDir, host.id);
  const snippet = renderSnippet(host, manifest.project);
  const readme = [
    `# ${host.label} Runtime Integration`,
    '',
    'This file is generated. Do not edit by hand.',
    '',
    `- Config file: ${host.configFile}`,
    `- Snippet target: ${host.snippetTarget}`,
    `- Capability level: ${host.capabilityLevel}`,
    `- Supported executors: ${host.supportedExecutors.join(', ')}`,
    '',
    '## Injection Snippet',
    '',
    snippet,
  ].join('\n');

  writeFile(path.join(hostDir, 'README.md'), readme);
  writeFile(path.join(hostDir, `${host.configFile.replace(/\.[^.]+$/, '')}-snippet.md`), snippet);
}

writeJson(path.join(registryDir, 'hosts.json'), manifest.hosts);
writeJson(path.join(registryDir, 'capabilities.json'), capabilities);
writeJson(path.join(registryDir, 'agents.json'), agents);
writeJson(path.join(registryDir, 'recommendations.json'), recommendationTemplates);

writeFile(
  path.join(generatedDir, 'README.md'),
  [
    '# Generated Runtime Artifacts',
    '',
    'This directory is generated by `hq/scripts/generate-runtime-artifacts.mjs`.',
    '',
    `- Hosts: ${manifest.hosts.length}`,
    `- Agents: ${agents.length}`,
    `- Capabilities: ${capabilities.length}`,
  ].join('\n')
);

console.log(`Generated runtime artifacts in ${generatedDir}`);
