# Lightweight Execution Service Guide

This guide explains how to use the lightweight execution service for non-risky tasks in The Agency HQ.

## Overview

The lightweight execution service allows you to execute tasks that:
- Have **low risk level** (assessed by the risk assessment engine)
- **Do not require approval** (approvalRequired: false)
- Can be executed directly without the approval workflow

## Quick Start

### 1. Run the Example Script

```bash
cd hq/backend
npm run build
npx tsx scripts/run-lightweight-task.ts
```

### 2. Verify Execution

```bash
npx tsx scripts/verify-lightweight-execution.ts
```

## Code Example

### Creating and Executing a Non-Risky Task

```typescript
import { Store } from '../src/store';
import { createTaskDraft } from '../src/orchestration/task-orchestrator';
import { executeTaskRecord } from '../src/orchestration/task-execution-orchestrator';

async function runLightweightTask() {
  // Initialize store
  const store = new Store();

  // Create a low-risk task
  const taskInput = {
    title: 'Calculate 2 + 2',
    description: 'What is 2 plus 2? Provide a simple answer.',
    taskType: 'general',
    priority: 'low',
  };

  const task = await createTaskDraft(taskInput, store);

  // Check if task requires approval
  if (task.approvalRequired) {
    console.log('Task requires approval - use approval workflow');
    return;
  }

  // Execute the task
  const result = await executeTaskRecord(
    task,
    {
      executor: 'claude',
      summary: `Calculate: ${taskInput.title}`,
      timeoutMs: 30000,
      maxRetries: 1,
    },
    store,
    {
      loadMemoryContext: async () => undefined,
      writeExecutionSummary: async () => {},
      sessionCapabilities: { sampling: false },
    }
  );

  console.log('Execution result:', result.execution.outputSummary);
  console.log('Task status:', result.task.status);
}
```

## Risk Assessment

Tasks are assessed for risk based on:

| Factor | Low Risk | Medium/High Risk |
|--------|----------|------------------|
| Keywords | Simple queries | "delete", "deploy", "production" |
| Task Type | general, documentation | backend_implementation, database_migration |
| Execution Mode | single | serial, parallel, advanced_discussion |
| Priority | low | high, critical |

### Examples of Non-Risky Tasks

```typescript
// ✅ Low risk - simple calculation
{
  title: 'Calculate 2 + 2',
  description: 'What is 2 plus 2?',
}

// ✅ Low risk - documentation
{
  title: 'Write API documentation',
  description: 'Document the /api/tasks endpoint',
  taskType: 'documentation',
}

// ✅ Low risk - general query
{
  title: 'Explain TypeScript types',
  description: 'What is the difference between interface and type?',
}
```

### Examples of Risky Tasks (Require Approval)

```typescript
// ❌ High risk - contains "delete" keyword
{
  title: 'Delete all user data',
  description: 'Remove all users from the database',
}

// ❌ Medium risk - backend implementation
{
  title: 'Implement payment processing',
  description: 'Add Stripe integration for payments',
  taskType: 'backend_implementation',
}

// ❌ Medium risk - production deployment
{
  title: 'Deploy to production',
  description: 'Deploy the latest changes to production',
}
```

## Execution Parameters

```typescript
interface ExecutionParams {
  executor: 'claude' | 'codex' | 'openai';  // Which AI executor to use
  summary: string;                          // Human-readable summary
  executionMode?: 'single' | 'serial' | 'parallel' | 'advanced_discussion';
  timeoutMs?: number;                       // Max execution time (default: 2min)
  maxRetries?: number;                      // Retry count (default: 1)
}
```

## Execution Context Options

```typescript
interface ExecutionContext {
  runAdvancedDiscussion?: (topic: string) => Promise<{ summary: string }>;
  loadMemoryContext?: (task: TaskRecord) => Promise<string | undefined>;
  writeExecutionSummary?: (task: TaskRecord, execution: ExecutionRecord) => Promise<void>;
  sessionCapabilities?: { sampling: boolean };
}
```

## Retrieving Execution Results

```typescript
// Get executions for a task
const executions = await store.getExecutionsByTaskId(taskId);

// Get latest execution
const latestExecution = executions.sort((a, b) =>
  b.completedAt.localeCompare(a.completedAt)
)[0];

console.log('Status:', latestExecution.status);
console.log('Output:', latestExecution.outputSummary);
console.log('Executor:', latestExecution.executor);
console.log('Duration:', latestExecution.completedAt - latestExecution.startedAt);
```

## Execution States

| Status | Description |
|--------|-------------|
| `pending` | Execution started, waiting for runtime |
| `running` | Runtime is executing the task |
| `completed` | Execution completed successfully |
| `failed` | Execution failed (check errorMessage) |
| `cancelled` | Execution was cancelled |
| `degraded` | Execution completed with degraded runtime |

## Error Handling

```typescript
try {
  const result = await executeTaskRecord(task, params, store, context);

  if (result.execution.status === 'failed') {
    console.error('Execution failed:', result.execution.errorMessage);

    if (result.execution.structuredError) {
      console.error('Error code:', result.execution.structuredError.code);
      console.error('Retriable:', result.execution.structuredError.retriable);
    }
  }
} catch (error) {
  console.error('Fatal error:', error);
}
```

## Runtime Adapters

The lightweight execution service supports multiple runtime adapters:

### Claude Adapter (Default)
- Supports MCP tools (web search, document reading)
- Safe execution with allowed tools whitelist
- Best for: Research, documentation, general tasks

### Codex Adapter
- Optimized for code review
- Best for: Code analysis, review tasks

### OpenAI Adapter
- Direct OpenAI API integration
- Best for: Simple queries without MCP tools

## Best Practices

1. **Always check risk level** before executing
2. **Set appropriate timeouts** based on task complexity
3. **Handle errors gracefully** - check execution status
4. **Use sampling capability** when available for better results
5. **Load memory context** for tasks that benefit from historical data
6. **Write execution summaries** for knowledge base persistence

## Troubleshooting

### Task requires approval
- Check `task.approvalRequired` before execution
- Use the approval workflow instead of direct execution

### Execution timeout
- Increase `timeoutMs` parameter
- Check if the task is too complex for lightweight execution

### Degraded execution
- Runtime may be unavailable
- Check executor configuration (AGENCY_TASK_CLAUDE_PATH)
- Fallback to alternative executor

### No output
- Check execution status (should be `completed`)
- Verify executor is configured correctly
- Check execution logs for errors
