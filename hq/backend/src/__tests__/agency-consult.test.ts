import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExpertCandidate } from '../orchestration/expert-discovery';
import { buildConsultAssignment, selectBestExpert } from '../orchestration/agency-consult';

test('selectBestExpert returns the highest-ranked expert', () => {
  const candidates: ExpertCandidate[] = [
    {
      id: 'technical-writer',
      name: 'Technical Writer',
      description: 'Writes docs.',
      department: 'support',
      score: 50,
      isActive: true,
    },
    {
      id: 'software-architect',
      name: 'Software Architect',
      description: 'Owns architecture.',
      department: 'engineering',
      score: 99,
      isActive: false,
    },
  ];

  const best = selectBestExpert(candidates);
  assert.equal(best?.id, 'software-architect');
});

test('buildConsultAssignment creates a focused advisory brief', () => {
  const assignment = buildConsultAssignment({
    task: 'Review the architecture direction',
    expertName: 'Software Architect',
    expertDescription: 'Owns architecture and boundaries.',
  });

  assert.equal(assignment.includes('任务：Review the architecture direction'), true);
  assert.equal(assignment.includes('你当前扮演的专家：Software Architect'), true);
  assert.equal(assignment.includes('你的核心判断'), true);
});
