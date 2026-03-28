import { resolveRuntimeAdapter } from '../src/runtime/runtime-adapter';

async function testDeerFlow() {
  console.log("Locating DeerFlow adapter...");
  const adapter = resolveRuntimeAdapter('deerflow');
  
  if (!adapter) {
    console.error("Failed to resolve deerflow adapter!");
    process.exit(1);
  }

  console.log(`Adapter found: ${adapter.name}`);
  console.log("Sending dummy task to Workshop...");

  try {
    const result = await adapter.run({
      task: {
        id: "test-task-001",
        title: "Walking Skeleton Test",
        description: "Test physical connectivity",
        taskType: "general",
        priority: "low",
        status: "running",
        executionMode: "single",
        approvalRequired: false,
        riskLevel: "low",
        requestedBy: "system",
        requestedAt: new Date().toISOString(),
        recommendedAgentRole: "any",
        candidateAgentRoles: [],
        routeReason: "test",
        routingStatus: "matched",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      executor: 'deerflow',
      runtimeName: adapter.name,
      executionMode: 'single',
      summary: 'Testing DeerFlow Integration',
      timeoutMs: 5000,
      maxRetries: 1,
      inputSnapshot: {
        testData: "Hello from TS Office!"
      }
    });

    console.log("\n✅ Success! Received response from Python Workshop:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("\n❌ Failed to execute task on DeerFlow adapter:", err);
  }
}

testDeerFlow();