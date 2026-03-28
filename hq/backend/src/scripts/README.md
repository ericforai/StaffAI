# Backend Scripts

This directory contains utility scripts for The Agency HQ backend.

## generate-execution-records.ts

Generate test execution records for the `/api/executions` history endpoint.

### Usage

```bash
npm run generate:executions [options]
```

### Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--count <number>` | `-c` | Number of execution records to generate | 10 |
| `--task-id <uuid>` | `-t` | Use existing task ID instead of generating new one | auto-generated |
| `--output <file>` | `-o` | Output file path (JSON format) | stdout |
| `--days <number>` | `-d` | Time period in days to spread executions | 7 |
| `--help` | `-h` | Show help message | - |

### Examples

```bash
# Generate 10 executions to stdout
npm run generate:executions

# Generate 50 executions and save to file
npm run generate:executions -c 50 -o ./test-data/executions.json

# Generate executions for existing task
npm run generate:executions --task-id abc-123-def-456 -o executions.json

# Generate 100 executions spread over 30 days
npm run generate:executions -c 100 -d 30 -o ./executions-30days.json
```

### Output Format

When using `--output`, the script generates a JSON file with:

```json
{
  "task": {
    "id": "uuid",
    "title": "Test Task...",
    "description": "Generated test task...",
    ...
  },
  "executions": [
    {
      "id": "uuid",
      "displayExecutionId": "EXEC-0001",
      "taskId": "uuid",
      "status": "completed",
      "executor": "claude",
      "runtimeName": "claude-3.5",
      "startedAt": "2026-03-27T...",
      "endedAt": "2026-03-27T...",
      "completedAt": "2026-03-27T...",
      ...
    }
  ],
  "summary": {
    "total": 10,
    "statusCounts": { "completed": 5, "failed": 2, ... },
    "executorCounts": { "claude": 4, "codex": 3, ... }
  }
}
```

### Status Distribution

The generator weights execution status realistically:
- **50% completed** - Successful executions
- **15% failed** - Failed with error details
- **10% cancelled** - User/system cancelled
- **10% running** - Currently active
- **5% pending** - Waiting to start
- **5% paused** - Temporarily paused
- **5% degraded** - Completed with issues

### Use Cases

1. **Testing History Endpoint**:
   ```bash
   # Generate test data for GET /api/executions
   npm run generate:executions -c 100 -o test-data/executions.json

   # Load into file repository
   cp test-data/executions.json ~/.agency/executions.json
   ```

2. **Status Filtering Tests**:
   ```bash
   # Generate varied status records
   npm run generate:executions -c 50 -o executions.json
   # Test GET /api/executions?status=failed
   # Test GET /api/executions?status=completed
   ```

3. **Time-Based Queries**:
   ```bash
   # Generate records over 30 days
   npm run generate:executions -c 100 -d 30 -o executions.json
   # Test date range filtering and sorting
   ```

### Integration with Tests

The generator can be imported for use in tests:

```typescript
import { generateExecutionRecords } from './scripts/generate-execution-records';

test('GET /api/executions returns sorted list', async () => {
  const executions = await generateExecutionRecords({
    count: 20,
    daysBack: 7,
  });

  // Save to test store
  for (const execution of executions) {
    await store.saveExecution(execution);
  }

  const response = await request(app).get('/api/executions');
  assert.equal(response.body.executions.length, 20);
});
```

### Design Decisions

- **Weighted Distribution**: More realistic test data with 50% completed vs 15% failed
- **Time Ordering**: Records sorted by `startedAt` descending (most recent first)
- **Display IDs**: Human-readable IDs (e.g., `EXEC-0001`) for easier debugging
- **Structured Errors**: Failed executions include proper error structure
- **Output Snapshots**: Completed executions include mock metrics (tokens, response time)
