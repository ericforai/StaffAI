import { Scanner } from './scanner';
import { Store } from './store';
import { ToolGateway } from './tools/tool-gateway';
import { McpGateway } from './mcp';

async function main() {
  const scanner = new Scanner();
  await scanner.scan();
  // stderr is used for logging so it doesn't break MCP stdio
  console.error(`MCP Server: Scanned ${scanner.getAllAgents().length} agents.`);

  const store = new Store();
  const toolGateway = new ToolGateway(store);
  
  // Optionally, we could watch the active_squad.json file for changes
  // so the IDE doesn't need to restart the MCP server to see new tools.
  // The store loads synchronously, but `listTools` will read the live state
  // from the store which fetches from memory. 
  // Let's ensure the store reloads when file changes.
  import('fs').then(fs => {
    fs.watchFile(require('path').join(__dirname, '../../active_squad.json'), () => {
      console.error('Squad changed on disk, MCP will reflect new tools on next listTools call.');
      // The store needs a reload method, or we just rely on `getActiveIds` reading the file again.
      // We will quickly patch the Store class in the next step to re-read on every get.
    });
  });

  const mcp = new McpGateway(scanner, store, toolGateway);
  await mcp.start();
}

main().catch(console.error);
