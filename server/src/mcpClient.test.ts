// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMcpClientBridge } from './mcpClient';

interface MockClientInstance {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
}

const sdkMocks = vi.hoisted(() => {
  const clientInstances: MockClientInstance[] = [];
  const clientConstructor = vi.fn(function MockClient() {
    const instance: MockClientInstance = {
      connect: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      listTools: vi.fn(),
      callTool: vi.fn(),
    };
    clientInstances.push(instance);
    return instance;
  });

  return {
    clientInstances,
    clientConstructor,
    stdioTransportConstructor: vi.fn(function MockStdioTransport() {
      return { transport: 'stdio' };
    }),
    streamableHttpTransportConstructor: vi.fn(function MockStreamableHttpTransport() {
      return { transport: 'http' };
    }),
  };
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: sdkMocks.clientConstructor,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  getDefaultEnvironment: () => ({ PATH: '/usr/bin' }),
  StdioClientTransport: sdkMocks.stdioTransportConstructor,
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: sdkMocks.streamableHttpTransportConstructor,
}));

describe('createMcpClientBridge', () => {
  beforeEach(() => {
    sdkMocks.clientInstances.length = 0;
    vi.clearAllMocks();
  });

  it('lists all MCP tools across paginated SDK responses', async () => {
    const bridge = createMcpClientBridge();
    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/mcp',
    };
    sdkMocks.streamableHttpTransportConstructor.mockImplementation(function MockStreamableHttpTransport() {
      return { transport: 'http' };
    });

    const listToolsResults = [
      {
        tools: [
          {
            name: 'first_tool',
            inputSchema: { type: 'object' },
          },
        ],
        nextCursor: 'page-2',
      },
      {
        tools: [
          {
            name: 'second_tool',
            description: 'Second page tool',
            inputSchema: { type: 'object' },
          },
        ],
      },
    ];
    sdkMocks.clientConstructor.mockImplementationOnce(function MockClient() {
      const instance: MockClientInstance = {
        connect: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        listTools: vi.fn().mockResolvedValueOnce(listToolsResults[0]).mockResolvedValueOnce(listToolsResults[1]),
        callTool: vi.fn(),
      };
      sdkMocks.clientInstances.push(instance);
      return instance;
    });

    await expect(bridge.listTools(server)).resolves.toEqual([
      {
        name: 'first_tool',
        inputSchema: { type: 'object' },
      },
      {
        name: 'second_tool',
        description: 'Second page tool',
        inputSchema: { type: 'object' },
      },
    ]);

    const client = sdkMocks.clientInstances[0];
    expect(client.listTools).toHaveBeenNthCalledWith(1, undefined, { timeout: 60_000 });
    expect(client.listTools).toHaveBeenNthCalledWith(2, { cursor: 'page-2' }, { timeout: 60_000 });
    expect(client.close).toHaveBeenCalledOnce();
  });
});
