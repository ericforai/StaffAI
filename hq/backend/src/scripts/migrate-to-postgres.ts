/**
 * Data Migration Tool: File (JSON) to PostgreSQL
 *
 * This script migrates all core records from JSON files to a PostgreSQL database.
 * It is designed to be idempotent (using upsert logic).
 */

import path from 'path';
import fs from 'fs';
import {
  createFileTaskRepository,
  createFileApprovalRepository,
  createFileExecutionRepository,
  createFileTaskAssignmentRepository,
  createFileWorkflowPlanRepository,
  createFileToolCallLogRepository,
} from '../persistence/file-repositories';
import {
  createPostgresTaskRepository,
  createPostgresApprovalRepository,
  createPostgresExecutionRepository,
  createPostgresTaskAssignmentRepository,
  createPostgresWorkflowPlanRepository,
  createPostgresToolCallLogRepository,
} from '../persistence/postgres-repositories';
import {
  createFileAuditLogRepository,
  createPostgresAuditLogRepository,
} from '../persistence/audit-log-repositories';
import { createKnowledgeAdapter } from '../legacy/knowledge-adapter';
import { createPostgresKnowledgeAdapter } from '../persistence/postgres-knowledge-adapter';

// Paths to file repositories (relative to this script or process.cwd())
const KNOWLEDGE_FILE = path.join(process.cwd(), 'company_knowledge.json');
const TASKS_FILE = path.join(process.cwd(), 'tasks.json');
const APPROVALS_FILE = path.join(process.cwd(), 'approvals.json');
const EXECUTIONS_FILE = path.join(process.cwd(), 'executions.json');
const ASSIGNMENTS_FILE = path.join(process.cwd(), 'task_assignments.json');
const WORKFLOW_PLANS_FILE = path.join(process.cwd(), 'workflow_plans.json');
const TOOL_CALL_LOGS_FILE = path.join(process.cwd(), 'tool_call_logs.json');
const AUDIT_LOGS_DIR = path.join(process.cwd(), '.ai/audit');
const MEMORY_ROOT_DIR = path.join(process.cwd(), '.ai');

async function migrate() {
  const postgresUrl = process.env.AGENCY_POSTGRES_URL || process.env.DATABASE_URL;
  if (!postgresUrl) {
    console.error('ERROR: AGENCY_POSTGRES_URL or DATABASE_URL must be set.');
    process.exit(1);
  }

  const postgresOptions = {
    connectionString: postgresUrl,
    schema: process.env.AGENCY_POSTGRES_SCHEMA || 'public',
    taskTable: process.env.AGENCY_POSTGRES_TASKS_TABLE,
    approvalTable: process.env.AGENCY_POSTGRES_APPROVALS_TABLE,
    executionTable: process.env.AGENCY_POSTGRES_EXECUTIONS_TABLE,
    taskAssignmentTable: process.env.AGENCY_POSTGRES_TASK_ASSIGNMENTS_TABLE,
    workflowPlanTable: process.env.AGENCY_POSTGRES_WORKFLOW_PLANS_TABLE,
    toolCallLogTable: process.env.AGENCY_POSTGRES_TOOL_CALL_LOGS_TABLE,
  };

  console.log('--- Starting Migration to PostgreSQL ---');

  // 1. Tasks
  console.log('Migrating Tasks...');
  if (fs.existsSync(TASKS_FILE)) {
    const fileRepo = createFileTaskRepository(TASKS_FILE);
    const pgRepo = createPostgresTaskRepository(postgresOptions);
    const records = await fileRepo.list();
    for (const record of records) {
      await pgRepo.save(record);
    }
    console.log(`Migrated ${records.length} tasks.`);
  }

  // 2. Approvals
  console.log('Migrating Approvals...');
  if (fs.existsSync(APPROVALS_FILE)) {
    const fileRepo = createFileApprovalRepository(APPROVALS_FILE);
    const pgRepo = createPostgresApprovalRepository(postgresOptions);
    const records = await fileRepo.list();
    for (const record of records) {
      await pgRepo.save(record);
    }
    console.log(`Migrated ${records.length} approvals.`);
  }

  // 3. Executions
  console.log('Migrating Executions...');
  if (fs.existsSync(EXECUTIONS_FILE)) {
    const fileRepo = createFileExecutionRepository(EXECUTIONS_FILE);
    const pgRepo = createPostgresExecutionRepository(postgresOptions);
    const records = await fileRepo.list();
    for (const record of records) {
      await pgRepo.save(record);
    }
    console.log(`Migrated ${records.length} executions.`);
  }

  // 4. Assignments
  console.log('Migrating Task Assignments...');
  if (fs.existsSync(ASSIGNMENTS_FILE)) {
    const fileRepo = createFileTaskAssignmentRepository(ASSIGNMENTS_FILE);
    const pgRepo = createPostgresTaskAssignmentRepository(postgresOptions);
    const records = await fileRepo.list();
    for (const record of records) {
      await pgRepo.save(record);
    }
    console.log(`Migrated ${records.length} assignments.`);
  }

  // 5. Workflow Plans
  console.log('Migrating Workflow Plans...');
  if (fs.existsSync(WORKFLOW_PLANS_FILE)) {
    const fileRepo = createFileWorkflowPlanRepository(WORKFLOW_PLANS_FILE);
    const pgRepo = createPostgresWorkflowPlanRepository(postgresOptions);
    const records = await fileRepo.list();
    for (const record of records) {
      await pgRepo.save(record);
    }
    console.log(`Migrated ${records.length} workflow plans.`);
  }

  // 6. Tool Call Logs
  console.log('Migrating Tool Call Logs...');
  if (fs.existsSync(TOOL_CALL_LOGS_FILE)) {
    const fileRepo = createFileToolCallLogRepository(TOOL_CALL_LOGS_FILE);
    const pgRepo = createPostgresToolCallLogRepository(postgresOptions);
    const records = await fileRepo.list();
    for (const record of records) {
      await pgRepo.save(record);
    }
    console.log(`Migrated ${records.length} tool call logs.`);
  }

  // 7. Audit Logs
  console.log('Migrating Audit Logs...');
  if (fs.existsSync(AUDIT_LOGS_DIR)) {
    const fileRepo = createFileAuditLogRepository(AUDIT_LOGS_DIR);
    const pgRepo = createPostgresAuditLogRepository({
      connectionString: postgresUrl,
      schema: postgresOptions.schema,
      tableName: process.env.AGENCY_POSTGRES_AUDIT_LOGS_TABLE || 'audit_logs',
    });
    
    // Audit logs are Partitioned by date in files, but createFileAuditLogRepository can search them.
    // However, it doesn't have a "listAll" method.
    // We'll manually read all JSON files in the audit directory.
    const auditFiles = fs.readdirSync(AUDIT_LOGS_DIR).filter(f => f.endsWith('.json'));
    let totalAuditLogs = 0;
    for (const file of auditFiles) {
      const content = fs.readFileSync(path.join(AUDIT_LOGS_DIR, file), 'utf-8');
      const logs = JSON.parse(content);
      if (Array.isArray(logs)) {
        for (const log of logs) {
          await pgRepo.save(log);
          totalAuditLogs++;
        }
      }
    }
    console.log(`Migrated ${totalAuditLogs} audit logs.`);
  }

  // 8. Knowledge Base
  console.log('Migrating Knowledge Base...');
  const fileAdapter = createKnowledgeAdapter(MEMORY_ROOT_DIR, KNOWLEDGE_FILE);
  const pgAdapter = createPostgresKnowledgeAdapter({
    connectionString: postgresUrl,
    schema: postgresOptions.schema,
    tableName: process.env.AGENCY_POSTGRES_KNOWLEDGE_TABLE || 'knowledge_base',
  });
  
  const knowledgeEntries = await fileAdapter.getAll();
  for (const entry of knowledgeEntries) {
    await pgAdapter.save({
      task: entry.task,
      agentId: entry.agentId,
      resultSummary: entry.resultSummary,
      timestamp: entry.timestamp,
    });
  }
  console.log(`Migrated ${knowledgeEntries.length} knowledge entries.`);

  console.log('--- Migration Complete ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
