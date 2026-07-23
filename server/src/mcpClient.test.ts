// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMcpClientBridge } from './mcpClient';

interface MockClientInstance {
  connect: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  listResources: ReturnType<typeof vi.fn>;
  listResourceTemplates: ReturnType<typeof vi.fn>;
  readResource: ReturnType<typeof vi.fn>;
  listPrompts: ReturnType<typeof vi.fn>;
  getPrompt: ReturnType<typeof vi.fn>;
}

const sdkMocks = vi.hoisted(() => {
  const clientInstances: MockClientInstance[] = [];
  const clientConstructor = vi.fn(function MockClient() {
    const instance: MockClientInstance = {
      connect: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      listTools: vi.fn(),
      callTool: vi.fn(),
      listResources: vi.fn(),
      listResourceTemplates: vi.fn(),
      readResource: vi.fn(),
      listPrompts: vi.fn(),
      getPrompt: vi.fn(),
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
    sseTransportConstructor: vi.fn(function MockSseTransport() {
      return { transport: 'sse' };
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

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: sdkMocks.sseTransportConstructor,
}));

// ponytail: decouple version assertion from the real package.json
vi.mock('node:fs', () => ({
  readFileSync: () => JSON.stringify({ version: '9.9.9-test' }),
}));

// Skip DNS rebinding checks in unit tests (public hostnames would otherwise hit the network).
vi.mock('./mcpHttpSecurity.js', async () => {
  const actual = await vi.importActual<typeof import('./mcpHttpSecurity.js')>('./mcpHttpSecurity.js');
  return {
    ...actual,
    assertMcpHttpUrlAllowed: vi.fn(async () => undefined),
    createSafeMcpFetch: vi.fn((_allowPrivate: boolean, baseFetch: typeof fetch = fetch) => baseFetch),
  };
});

describe('createMcpClientBridge', () => {
  let bridges: Array<ReturnType<typeof createMcpClientBridge>> = [];

  beforeEach(() => {
    sdkMocks.clientInstances.length = 0;
    bridges = [];
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await Promise.all(bridges.map((bridge) => bridge.dispose?.() ?? Promise.resolve()));
    bridges = [];
  });

  const createBridge = (...args: Parameters<typeof createMcpClientBridge>) => {
    const bridge = createMcpClientBridge(...args);
    bridges.push(bridge);
    return bridge;
  };

  it('lists all MCP tools across paginated SDK responses and reuses the pooled session', async () => {
    const bridge = createBridge();
    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/mcp',
    };

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
        callTool: vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] })),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        readResource: vi.fn(),
        listPrompts: vi.fn(),
        getPrompt: vi.fn(),
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
    // Pooled: session stays open until dispose / idle eviction.
    expect(client.close).not.toHaveBeenCalled();
    expect(sdkMocks.clientConstructor).toHaveBeenCalledWith({
      name: 'amc-webui',
      version: '9.9.9-test',
    });

    // Second operation reuses the same client connection.
    await bridge.callTool(server, 'first_tool', {});
    expect(sdkMocks.clientConstructor).toHaveBeenCalledTimes(1);
    expect(client.callTool).toHaveBeenCalledOnce();
  });

  it('lists resources and prompts on a shared session; tolerates missing resource templates', async () => {
    const bridge = createBridge();
    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/mcp',
    };

    sdkMocks.clientConstructor.mockImplementationOnce(function MockResourceClient() {
      const instance: MockClientInstance = {
        connect: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        listTools: vi.fn(),
        callTool: vi.fn(),
        listResources: vi
          .fn()
          .mockResolvedValueOnce({
            resources: [{ uri: 'file:///tmp/one.md', name: 'One' }],
            nextCursor: 'resources-2',
          })
          .mockResolvedValueOnce({
            resources: [{ uri: 'file:///tmp/two.md', name: 'Two' }],
          }),
        listResourceTemplates: vi.fn(async () => {
          throw new Error('Method not found');
        }),
        readResource: vi.fn(),
        listPrompts: vi
          .fn()
          .mockResolvedValueOnce({
            prompts: [{ name: 'summarize' }],
            nextCursor: 'prompts-2',
          })
          .mockResolvedValueOnce({
            prompts: [{ name: 'rewrite', description: 'Rewrite text' }],
          }),
        getPrompt: vi.fn(),
      };
      sdkMocks.clientInstances.push(instance);
      return instance;
    });

    await expect(bridge.listResourcesAndTemplates!(server)).resolves.toEqual({
      resources: [
        { uri: 'file:///tmp/one.md', name: 'One' },
        { uri: 'file:///tmp/two.md', name: 'Two' },
      ],
      resourceTemplates: [],
    });

    await expect(bridge.listPrompts!(server)).resolves.toEqual([
      { name: 'summarize' },
      { name: 'rewrite', description: 'Rewrite text' },
    ]);

    // Single pooled client for both operations.
    expect(sdkMocks.clientConstructor).toHaveBeenCalledTimes(1);
    expect(sdkMocks.clientInstances[0].listResources).toHaveBeenNthCalledWith(
      2,
      { cursor: 'resources-2' },
      { timeout: 60_000 },
    );
    expect(sdkMocks.clientInstances[0].listPrompts).toHaveBeenNthCalledWith(
      2,
      { cursor: 'prompts-2' },
      { timeout: 60_000 },
    );
  });

  it('reads resources, gets prompts, and sends bearer auth through HTTP transport headers', async () => {
    const bridge = createBridge();
    const server = {
      id: 'remote',
      name: 'Remote',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/mcp',
      auth: {
        type: 'bearer' as const,
        token: 'secret-token',
      },
    };

    sdkMocks.clientConstructor.mockImplementationOnce(function MockReadClient() {
      const instance: MockClientInstance = {
        connect: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        listTools: vi.fn(),
        callTool: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        readResource: vi.fn(async () => ({
          contents: [{ uri: 'file:///tmp/readme.md', text: 'hello' }],
        })),
        listPrompts: vi.fn(),
        getPrompt: vi.fn(async () => ({
          messages: [{ role: 'user', content: { type: 'text', text: 'hello prompt' } }],
        })),
      };
      sdkMocks.clientInstances.push(instance);
      return instance;
    });

    await expect(bridge.readResource!(server, 'file:///tmp/readme.md')).resolves.toEqual({
      contents: [{ uri: 'file:///tmp/readme.md', text: 'hello' }],
    });
    await expect(bridge.getPrompt!(server, 'summarize', { topic: 'MCP' })).resolves.toEqual({
      messages: [{ role: 'user', content: { type: 'text', text: 'hello prompt' } }],
    });

    expect(sdkMocks.clientInstances[0].readResource).toHaveBeenCalledWith(
      { uri: 'file:///tmp/readme.md' },
      { timeout: 60_000 },
    );
    expect(sdkMocks.clientInstances[0].getPrompt).toHaveBeenCalledWith(
      { name: 'summarize', arguments: { topic: 'MCP' } },
      { timeout: 60_000 },
    );
    expect(sdkMocks.streamableHttpTransportConstructor).toHaveBeenCalledWith(new URL('https://mcp.example.com/mcp'), {
      requestInit: {
        headers: {
          Authorization: 'Bearer secret-token',
        },
      },
      fetch: expect.any(Function),
    });
  });

  it('falls back to SSE when Streamable HTTP connect fails', async () => {
    const bridge = createBridge();
    const server = {
      id: 'legacy',
      name: 'Legacy SSE',
      enabled: true,
      transport: 'http' as const,
      url: 'https://mcp.example.com/sse',
    };

    let streamableConnects = 0;
    sdkMocks.streamableHttpTransportConstructor.mockImplementation(function FailingStreamable() {
      return { transport: 'http' };
    });
    sdkMocks.clientConstructor.mockImplementation(function MockClient() {
      const instance: MockClientInstance = {
        connect: vi.fn(async () => {
          streamableConnects += 1;
          if (streamableConnects === 1) {
            throw new Error('Streamable HTTP not supported');
          }
        }),
        close: vi.fn(async () => undefined),
        listTools: vi.fn(async () => ({ tools: [{ name: 'ping', inputSchema: { type: 'object' } }] })),
        callTool: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        readResource: vi.fn(),
        listPrompts: vi.fn(),
        getPrompt: vi.fn(),
      };
      sdkMocks.clientInstances.push(instance);
      return instance;
    });

    await expect(bridge.listTools(server)).resolves.toEqual([{ name: 'ping', inputSchema: { type: 'object' } }]);

    expect(sdkMocks.streamableHttpTransportConstructor).toHaveBeenCalled();
    expect(sdkMocks.sseTransportConstructor).toHaveBeenCalledWith(new URL('https://mcp.example.com/sse'), {
      requestInit: undefined,
      fetch: expect.any(Function),
    });
  });

  it('uses SSE transport only when transport is sse', async () => {
    const bridge = createBridge();
    const server = {
      id: 'sse-only',
      name: 'SSE Only',
      enabled: true,
      transport: 'sse' as const,
      url: 'https://mcp.example.com/sse',
    };

    sdkMocks.clientConstructor.mockImplementationOnce(function MockClient() {
      const instance: MockClientInstance = {
        connect: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        listTools: vi.fn(async () => ({ tools: [] })),
        callTool: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        readResource: vi.fn(),
        listPrompts: vi.fn(),
        getPrompt: vi.fn(),
      };
      sdkMocks.clientInstances.push(instance);
      return instance;
    });

    await bridge.listTools(server);

    expect(sdkMocks.streamableHttpTransportConstructor).not.toHaveBeenCalled();
    expect(sdkMocks.sseTransportConstructor).toHaveBeenCalledOnce();
  });
});
