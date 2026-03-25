import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuditLogger,
  sanitizeState,
  extractStateChanges,
  type AuditEvent,
  type AuditEntityType,
} from '../governance/audit-logger';
import {
  createInMemoryAuditLogRepository,
  FileAuditLogRepository,
} from '../persistence/audit-log-repositories';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

test('AuditLogger.log creates entry with generated ID and timestamp', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);

  const event: AuditEvent = {
    entityType: 'approval',
    entityId: 'approval-123',
    action: 'approved',
    actor: 'user-1',
    previousState: { status: 'pending' },
    newState: { status: 'approved' },
    reason: 'Request reviewed and approved',
  };

  const entry = await auditLogger.log(event);

  assert.ok(entry.id);
  assert.ok(entry.timestamp);
  assert.equal(entry.entityType, 'approval');
  assert.equal(entry.entityId, 'approval-123');
  assert.equal(entry.action, 'approved');
  assert.equal(entry.actor, 'user-1');
  assert.deepEqual(entry.previousState, { status: 'pending' });
  assert.deepEqual(entry.newState, { status: 'approved' });
  assert.equal(entry.reason, 'Request reviewed and approved');
});

test('AuditLogger.log handles events without optional fields', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);

  const event: AuditEvent = {
    entityType: 'task',
    entityId: 'task-456',
    action: 'created',
    actor: 'system',
  };

  const entry = await auditLogger.log(event);

  assert.ok(entry.id);
  assert.ok(entry.timestamp);
  assert.equal(entry.previousState, undefined);
  assert.equal(entry.newState, undefined);
  assert.equal(entry.reason, undefined);
  assert.equal(entry.metadata, undefined);
});

test('AuditLogger.getAuditTrail returns trail ordered newest first', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);
  const entityId = randomUUID();

  // Log events in chronological order
  await auditLogger.log({
    entityType: 'task',
    entityId,
    action: 'created',
    actor: 'system',
    newState: { status: 'created' },
  });

  await new Promise((resolve) => setTimeout(resolve, 10));

  await auditLogger.log({
    entityType: 'task',
    entityId,
    action: 'updated',
    actor: 'user-1',
    previousState: { status: 'created' },
    newState: { status: 'running' },
  });

  await new Promise((resolve) => setTimeout(resolve, 10));

  await auditLogger.log({
    entityType: 'task',
    entityId,
    action: 'completed',
    actor: 'system',
    previousState: { status: 'running' },
    newState: { status: 'completed' },
  });

  const trail = await auditLogger.getAuditTrail(entityId);

  assert.equal(trail.length, 3);
  assert.equal(trail[0].action, 'completed'); // Newest first
  assert.equal(trail[1].action, 'updated');
  assert.equal(trail[2].action, 'created');
});

test('AuditLogger.getAuditTrail returns empty for non-existent entity', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);

  const trail = await auditLogger.getAuditTrail('non-existent');
  assert.deepEqual(trail, []);
});

test('AuditLogger.getAuditLogsByType filters by entity type', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);
  const taskId = randomUUID();
  const approvalId = randomUUID();

  await auditLogger.log({
    entityType: 'task',
    entityId: taskId,
    action: 'created',
    actor: 'system',
  });

  await auditLogger.log({
    entityType: 'approval',
    entityId: approvalId,
    action: 'approved',
    actor: 'user-1',
  });

  await auditLogger.log({
    entityType: 'task',
    entityId: taskId,
    action: 'updated',
    actor: 'user-1',
  });

  const taskLogs = await auditLogger.getAuditLogsByType('task');
  const approvalLogs = await auditLogger.getAuditLogsByType('approval');

  assert.equal(taskLogs.length, 2);
  assert.equal(approvalLogs.length, 1);
  assert.ok(taskLogs.every((log) => log.entityType === 'task'));
  assert.equal(approvalLogs[0].entityId, approvalId);
});

test('AuditLogger.getAuditLogsByActor filters by actor', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);
  const entityId1 = randomUUID();
  const entityId2 = randomUUID();

  await auditLogger.log({
    entityType: 'task',
    entityId: entityId1,
    action: 'created',
    actor: 'system',
  });

  await auditLogger.log({
    entityType: 'approval',
    entityId: entityId1,
    action: 'approved',
    actor: 'user-1',
  });

  await auditLogger.log({
    entityType: 'task',
    entityId: entityId2,
    action: 'updated',
    actor: 'user-1',
  });

  const systemLogs = await auditLogger.getAuditLogsByActor('system');
  const userLogs = await auditLogger.getAuditLogsByActor('user-1');

  assert.equal(systemLogs.length, 1);
  assert.equal(userLogs.length, 2);
  assert.ok(userLogs.every((log) => log.actor === 'user-1'));
});

test('AuditLogger.getAuditLogsByTimeRange filters by time range', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);
  const entityId = randomUUID();

  await auditLogger.log({
    entityType: 'task',
    entityId,
    action: 'created',
    actor: 'system',
    metadata: { testTime: 'now' },
  });

  // Recent logs should include our entry
  const startTime = new Date(Date.now() - 60 * 1000).toISOString();
  const endTime = new Date(Date.now() + 60 * 1000).toISOString();

  const logs = await auditLogger.getAuditLogsByTimeRange(startTime, endTime);

  assert.ok(logs.length > 0);
  assert.equal(logs[0].entityId, entityId);
});

test('AuditLogger.query supports multiple filters', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);
  const taskId1 = randomUUID();
  const taskId2 = randomUUID();
  const approvalId = randomUUID();

  await auditLogger.log({
    entityType: 'task',
    entityId: taskId1,
    action: 'created',
    actor: 'system',
    newState: { title: 'First task' },
  });

  await auditLogger.log({
    entityType: 'approval',
    entityId: approvalId,
    action: 'approved',
    actor: 'user-1',
    previousState: { status: 'pending' },
    newState: { status: 'approved' },
  });

  await auditLogger.log({
    entityType: 'task',
    entityId: taskId2,
    action: 'created',
    actor: 'user-1',
    newState: { title: 'Second task' },
  });

  // Query by entity type
  const byType = await auditLogger.query({ entityType: 'task' });
  assert.equal(byType.length, 2);
  assert.ok(byType.every((r) => r.entityType === 'task'));

  // Query by entity ID
  const allLogs = await auditLogger.query({ entityType: 'task' });
  const specificId = allLogs[0].entityId;
  const byId = await auditLogger.query({ entityId: specificId });
  assert.equal(byId.length, 1);
  assert.equal(byId[0].entityId, specificId);

  // Query by actor
  const byActor = await auditLogger.query({ actor: 'user-1' });
  assert.equal(byActor.length, 2);
  assert.ok(byActor.every((r) => r.actor === 'user-1'));

  // Query with limit
  const withLimit = await auditLogger.query({ entityType: 'task', limit: 1 });
  assert.equal(withLimit.length, 1);

  // Query with no filters returns empty (safety)
  const noFilters = await auditLogger.query({});
  assert.deepEqual(noFilters, []);
});

test('AuditLogger.getById returns specific entry', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);

  const entry = await auditLogger.log({
    entityType: 'task',
    entityId: randomUUID(),
    action: 'created',
    actor: 'system',
  });

  const found = await auditLogger.getById(entry.id);

  assert.deepEqual(found, entry);
});

test('AuditLogger.getById returns null for non-existent ID', async () => {
  const repository = createInMemoryAuditLogRepository();
  const auditLogger = new AuditLogger(repository);

  const found = await auditLogger.getById('non-existent-id');
  assert.equal(found, null);
});

test('sanitizeState redacts sensitive fields', () => {
  const state = {
    username: 'john',
    password: 'secret123',
    apiKey: 'key-abc-123',
    normalField: 'value',
    nested: {
      token: 'hidden',
      safe: 'visible',
    },
  };

  const sanitized = sanitizeState(state);

  assert.equal(sanitized.username, 'john');
  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.apiKey, '[REDACTED]');
  assert.equal(sanitized.normalField, 'value');
  assert.equal((sanitized.nested as Record<string, unknown>).token, '[REDACTED]');
  assert.equal((sanitized.nested as Record<string, unknown>).safe, 'visible');
});

test('sanitizeState truncates large arrays', () => {
  const state = {
    smallArray: [1, 2, 3],
    largeArray: Array.from({ length: 150 }, (_, i) => i),
  };

  const sanitized = sanitizeState(state);

  assert.deepEqual(sanitized.smallArray, [1, 2, 3]);
  assert.equal(sanitized.largeArray, '[150 items, truncated]');
});

test('sanitizeState handles objects without sensitive data', () => {
  const state = {
    name: 'test',
    count: 42,
    active: true,
  };

  const sanitized = sanitizeState(state);

  assert.deepEqual(sanitized, state);
});

test('extractStateChanges returns all fields when previous is undefined', () => {
  const current = {
    name: 'test',
    status: 'active',
  };

  const changes = extractStateChanges(undefined, current);

  assert.deepEqual(changes, { all: current });
});

test('extractStateChanges detects changes between states', () => {
  const previous = {
    name: 'test',
    status: 'pending',
    count: 5,
  };

  const current = {
    name: 'test',
    status: 'active',
    count: 10,
  };

  const changes = extractStateChanges(previous, current);

  assert.deepEqual(changes.status, { from: 'pending', to: 'active' });
  assert.deepEqual(changes.count, { from: 5, to: 10 });
  assert.equal(changes.name, undefined);
});

test('extractStateChanges handles nested objects', () => {
  const previous = {
    id: '123',
    nested: { value: 'old' },
  };

  const current = {
    id: '123',
    nested: { value: 'new' },
  };

  const changes = extractStateChanges(previous, current);

  assert.deepEqual(changes.nested, { from: { value: 'old' }, to: { value: 'new' } });
});

test('FileAuditLogRepository saves to date-based files', async () => {
  const tempDir = path.join(tmpdir(), `audit-test-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const repository = new FileAuditLogRepository(tempDir);

    const entry = {
      id: randomUUID(),
      entityType: 'task' as AuditEntityType,
      entityId: 'task-123',
      action: 'created',
      actor: 'system',
      timestamp: new Date().toISOString(),
    };

    await repository.save(entry);

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const expectedFile = path.join(tempDir, `${year}-${month}-${day}.json`);

    assert.ok(fs.existsSync(expectedFile));

    const content = fs.readFileSync(expectedFile, 'utf-8');
    const saved = JSON.parse(content);
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0], entry);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('FileAuditLogRepository retrieves by entity ID', async () => {
  const tempDir = path.join(tmpdir(), `audit-test-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const repository = new FileAuditLogRepository(tempDir);
    const entityId = randomUUID();

    await repository.save({
      id: randomUUID(),
      entityType: 'task',
      entityId,
      action: 'created',
      actor: 'system',
      timestamp: new Date().toISOString(),
    });

    await repository.save({
      id: randomUUID(),
      entityType: 'task',
      entityId,
      action: 'updated',
      actor: 'user-1',
      timestamp: new Date().toISOString(),
    });

    const trail = await repository.getByEntityId(entityId);

    assert.equal(trail.length, 2);
    assert.ok(trail.every((entry) => entry.entityId === entityId));
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('FileAuditLogRepository retrieves by entity type', async () => {
  const tempDir = path.join(tmpdir(), `audit-test-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const repository = new FileAuditLogRepository(tempDir);

    await repository.save({
      id: randomUUID(),
      entityType: 'task',
      entityId: 'task-1',
      action: 'created',
      actor: 'system',
      timestamp: new Date().toISOString(),
    });

    await repository.save({
      id: randomUUID(),
      entityType: 'approval',
      entityId: 'approval-1',
      action: 'approved',
      actor: 'user-1',
      timestamp: new Date().toISOString(),
    });

    const taskLogs = await repository.getByEntityType('task');

    assert.equal(taskLogs.length, 1);
    assert.equal(taskLogs[0].entityType, 'task');
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

test('FileAuditLogRepository retrieves by actor', async () => {
  const tempDir = path.join(tmpdir(), `audit-test-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const repository = new FileAuditLogRepository(tempDir);

    await repository.save({
      id: randomUUID(),
      entityType: 'task',
      entityId: 'task-1',
      action: 'created',
      actor: 'system',
      timestamp: new Date().toISOString(),
    });

    await repository.save({
      id: randomUUID(),
      entityType: 'approval',
      entityId: 'approval-1',
      action: 'approved',
      actor: 'user-1',
      timestamp: new Date().toISOString(),
    });

    const userLogs = await repository.getByActor('user-1');

    assert.equal(userLogs.length, 1);
    assert.equal(userLogs[0].actor, 'user-1');
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});
