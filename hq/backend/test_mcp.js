import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import readline from 'readline';

async function testMCP() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/Users/user/agency-agents/hq/backend/dist/mcp-server.js']
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);

    // List tools
    const tools = await client.listTools();
    console.log('\n✅ MCP 连接成功！');
    console.log('\n📋 可用工具列表：\n');

    tools.tools.forEach((tool, i) => {
      console.log(`${i + 1}. ${tool.name}`);
      console.log(`   ${tool.description}`);
      console.log('');
    });

    // Test expert_discussion
    console.log('\n🧪 测试 expert_discussion 工具...\n');
    const result = await client.callTool({
      name: 'expert_discussion',
      arguments: { topic: '如何测试 MCP 工具' }
    });

    console.log(result.content[0].text);

  } catch (err) {
    console.error('❌ 测试失败:', err.message);
  } finally {
    await client.close();
  }
}

testMCP();
