import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../store';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Migration Verification Test
 * 
 * Verifies that the data migrated from JSON files to PostgreSQL matches correctly.
 * Note: Requires AGENCY_PERSISTENCE_MODE=postgres and valid DB connection.
 */

test('Migration Verification: Data Integrity', async () => {
  const mode = process.env.AGENCY_PERSISTENCE_MODE;
  if (mode !== 'postgres') {
    console.log('Skipping migration verification test: Not in postgres mode');
    return;
  }

  const store = new Store();
  
  // 1. Verify Tasks
  const tasksFilePath = path.join(__dirname, '../../../tasks.json');
  if (fs.existsSync(tasksFilePath)) {
    const tasksJson = JSON.parse(fs.readFileSync(tasksFilePath, 'utf-8'));
    const migratedTasks = await store.getTasks();
    
    // Total number of tasks should be at least what was in JSON
    assert.ok(migratedTasks.length >= tasksJson.length, `Expected at least ${tasksJson.length} tasks, found ${migratedTasks.length}`);
    
    // Check first task as sample
    if (tasksJson.length > 0) {
      const sample = tasksJson[0];
      const migrated = await store.getTaskById(sample.id);
      assert.ok(migrated, `Task ${sample.id} not found in PostgreSQL`);
      assert.equal(migrated.title, sample.title, 'Task title mismatch');
    }
  }

  // 2. Verify Audit Logs
  const auditLogger = store.getAuditLogger();
  if (auditLogger) {
    const logs = await auditLogger.getAuditLogsByTimeRange('2020-01-01', '2100-01-01');
    assert.ok(logs.length > 0, 'No audit logs found in PostgreSQL');
    console.log(`Verified ${logs.length} audit logs in PostgreSQL.`);
  }

  // 3. Verify Knowledge Base
  const knowledge = await store.getKnowledge();
  const knowledgeFilePath = path.join(__dirname, '../../../company_knowledge.json');
  if (fs.existsSync(knowledgeFilePath)) {
    const knowledgeJson = JSON.parse(fs.readFileSync(knowledgeFilePath, 'utf-8'));
    assert.ok(knowledge.length >= knowledgeJson.length, 'Knowledge base entries missing in PostgreSQL');
  }
});
