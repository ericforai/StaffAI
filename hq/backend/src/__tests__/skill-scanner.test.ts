import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillScanner } from '../skill-scanner';

async function withTempHome(testFn: (homeDir: string) => Promise<void> | void) {
  const originalHome = process.env.HOME;
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agency-skills-'));
  process.env.HOME = homeDir;

  try {
    await testFn(homeDir);
  } finally {
    process.env.HOME = originalHome;
    fs.rmSync(homeDir, { recursive: true, force: true });
  }
}

test('skill scanner merges duplicate skill installations across hosts', async () => {
  await withTempHome(async (homeDir) => {
    const claudeRoot = path.join(homeDir, '.claude/skills/review');
    const codexRoot = path.join(homeDir, '.codex/skills/review');

    fs.mkdirSync(claudeRoot, { recursive: true });
    fs.mkdirSync(codexRoot, { recursive: true });

    fs.writeFileSync(
      path.join(claudeRoot, 'SKILL.md'),
      `---
name: review
description: Claude review skill
allowed-tools:
  - Bash
---
body
`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(codexRoot, 'SKILL.md'),
      `---
name: review
description: Codex review skill
allowed-tools:
  - Read
---
body
`,
      'utf-8'
    );

    const scanner = new SkillScanner();
    const skills = await scanner.scan();
    const review = skills.find((skill) => skill.id === 'review');

    assert.ok(review);
    assert.equal(review?.installations.length, 2);
    assert.deepEqual(review?.allowedTools.sort(), ['Bash', 'Read']);
  });
});

test('skill scanner skips nested mirrored skill directories inside bundled packages', async () => {
  await withTempHome(async (homeDir) => {
    const bundledRoot = path.join(homeDir, '.claude/skills/gstack');
    const mirroredRoot = path.join(homeDir, '.claude/skills/gstack/.agents/skills/gstack-review');
    const directSkillRoot = path.join(bundledRoot, 'review');

    fs.mkdirSync(mirroredRoot, { recursive: true });
    fs.mkdirSync(directSkillRoot, { recursive: true });

    fs.writeFileSync(
      path.join(bundledRoot, 'SKILL.md'),
      `---
name: gstack
description: Root package
---
body
`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(directSkillRoot, 'SKILL.md'),
      `---
name: review
description: Review skill
---
body
`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(mirroredRoot, 'SKILL.md'),
      `---
name: mirrored
description: mirrored copy
---
body
`,
      'utf-8'
    );

    const scanner = new SkillScanner();
    const skills = await scanner.scan();

    assert.equal(skills.some((skill) => skill.id.includes('agents-skills')), false);
    assert.equal(skills.some((skill) => skill.id === 'gstack'), true);
    assert.equal(skills.some((skill) => skill.id === 'gstack-review'), true);
  });
});

test('skill scanner falls back to regex frontmatter extraction when YAML parsing fails', async () => {
  await withTempHome(async (homeDir) => {
    const brokenSkillRoot = path.join(homeDir, '.claude/skills/architecture-defense');
    fs.mkdirSync(brokenSkillRoot, { recursive: true });

    fs.writeFileSync(
      path.join(brokenSkillRoot, 'SKILL.md'),
      `---
name: architecture-defense
description: Enforce architectural rules automatically: block wrong dependencies, prevent layer violations
---
body
`,
      'utf-8'
    );

    const scanner = new SkillScanner();
    const skills = await scanner.scan();
    const recovered = skills.find((skill) => skill.id === 'architecture-defense');

    assert.ok(recovered);
    assert.equal(recovered?.name, 'architecture-defense');
    assert.equal(recovered?.description.includes('block wrong dependencies'), true);
  });
});
