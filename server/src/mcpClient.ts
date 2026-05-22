import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { McpClientBridge, McpServerConfig, McpTool } from './mcpTypes.js';

const MCP_REQUEST_TIMEOUT_MS = 60_000;

function createTransport(server: McpServerConfig): Transport {
  if (server.transport === 'stdio') {
    if (!server.command?.trim()) {
      throw new Error('MCP stdio server command is required.');
    }

    return new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env: server.env ? { ...getDefaultEnvironment(), ...server.env } : undefined,
      stderr: 'pipe',
    });
  }

  if (!server.url?.trim()) {
    throw new Error('MCP HTTP server URL is required.');
  }

  return new StreamableHTTPClientTransport(new URL(server.url), {
    requestInit: server.headers ? { headers: server.headers } : undefined,
  });
}

async function withConnectedClient<T>(server: McpServerConfig, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    name: 'amc-webui',
    version: '1.8.11',
  });
  const transport = createTransport(server);

  try {
    await client.connect(transport, { timeout: MCP_REQUEST_TIMEOUT_MS });
    return await run(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export const createMcpClientBridge = (): McpClientBridge => ({
  listTools: async (server) =>
    withConnectedClient(server, async (client) => {
      const tools: McpTool[] = [];
      let cursor: string | undefined;

      do {
        const result = await client.listTools(cursor ? { cursor } : undefined, { timeout: MCP_REQUEST_TIMEOUT_MS });
        tools.push(
          ...result.tools.map<McpTool>((tool) => ({
            name: tool.name,
            ...(tool.description ? { description: tool.description } : {}),
            inputSchema: tool.inputSchema,
          })),
        );
        cursor = result.nextCursor;
      } while (cursor);

      return tools;
    }),

  callTool: async (server, toolName, args) =>
    withConnectedClient(server, (client) =>
      client.callTool(
        {
          name: toolName,
          arguments: args,
        },
        undefined,
        { timeout: MCP_REQUEST_TIMEOUT_MS },
      ),
    ),
});
