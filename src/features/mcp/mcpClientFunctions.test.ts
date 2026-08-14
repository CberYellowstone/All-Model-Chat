import { Type } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import type { McpServerConfig } from '@/types';
import { createMcpClientFunctions } from './mcpClientFunctions';
import { toMcpFunctionName } from './mcpToolNames';

describe('createMcpClientFunctions', () => {
  const filesystemServer: McpServerConfig = {
    id: 'filesystem',
    name: 'Filesystem',
    enabled: true,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  };

  it('returns no functions when there are no enabled MCP servers', async () => {
    const listTools = vi.fn();

    await expect(
      createMcpClientFunctions({
        servers: [{ ...filesystemServer, enabled: false }],
        listTools,
        callTool: vi.fn(),
      }),
    ).resolves.toEqual({});

    expect(listTools).not.toHaveBeenCalled();
  });

  it('builds Gemini function declarations and handlers for discovered MCP tools', async () => {
    const listTools = vi.fn(async () => ({
      servers: [
        {
          serverId: 'filesystem',
          serverName: 'Filesystem',
          tools: [
            {
              name: 'read_file',
              description: 'Read a file from disk.',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: 'Path to read.',
                  },
                  includeMetadata: {
                    type: 'boolean',
                  },
                },
                required: ['path'],
              },
            },
          ],
        },
      ],
      errors: [],
    }));
    const callTool = vi.fn(async () => ({
      content: [{ type: 'text', text: 'file contents' }],
    }));
    const abortController = new AbortController();

    const functions = await createMcpClientFunctions({
      servers: [filesystemServer],
      listTools,
      callTool,
      abortSignal: abortController.signal,
    });
    const functionName = toMcpFunctionName('filesystem', 'read_file');

    expect(listTools).toHaveBeenCalledWith([filesystemServer], abortController.signal);
    expect(functions[functionName].declaration).toMatchObject({
      name: functionName,
      description: 'MCP tool read_file from Filesystem. Read a file from disk.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description: 'Path to read.',
          },
          includeMetadata: {
            type: Type.BOOLEAN,
          },
        },
        required: ['path'],
      },
    });

    await expect(
      functions[functionName].handler({ path: '/tmp/demo.txt' }, { abortSignal: abortController.signal }),
    ).resolves.toEqual({
      response: {
        content: [{ type: 'text', text: 'file contents' }],
      },
    });
    expect(callTool).toHaveBeenCalledWith(
      filesystemServer,
      'read_file',
      { path: '/tmp/demo.txt' },
      abortController.signal,
    );
  });

  it('uses runtime-unique server ids so duplicate user ids do not call the wrong MCP server', async () => {
    const secondServer: McpServerConfig = {
      ...filesystemServer,
      name: 'Second Filesystem',
      command: 'node',
      args: ['second-server.js'],
    };
    const listTools = vi.fn(async (servers: McpServerConfig[]) => ({
      servers: servers.map((server) => ({
        serverId: server.id,
        serverName: server.name,
        tools: [
          {
            name: 'read_file',
            inputSchema: {
              type: 'object',
            },
          },
        ],
      })),
      errors: [],
    }));
    const callTool = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }));

    const functions = await createMcpClientFunctions({
      servers: [filesystemServer, secondServer],
      listTools,
      callTool,
    });

    const requestedServers = listTools.mock.calls[0][0] as McpServerConfig[];
    expect(requestedServers).toHaveLength(2);
    expect(requestedServers[0].id).not.toBe(requestedServers[1].id);

    const functionNames = Object.keys(functions);
    expect(functionNames).toHaveLength(2);

    await functions[functionNames[0]].handler({ path: '/tmp/first.txt' });
    await functions[functionNames[1]].handler({ path: '/tmp/second.txt' });

    expect(callTool).toHaveBeenNthCalledWith(1, filesystemServer, 'read_file', { path: '/tmp/first.txt' }, undefined);
    expect(callTool).toHaveBeenNthCalledWith(2, secondServer, 'read_file', { path: '/tmp/second.txt' }, undefined);
  });

  it('does not throw when listTools fails so chat can continue without MCP tools', async () => {
    const listTools = vi.fn(async () => {
      throw new Error('MCP API proxy request failed: ECONNREFUSED');
    });

    await expect(
      createMcpClientFunctions({
        servers: [filesystemServer],
        listTools,
        callTool: vi.fn(),
      }),
    ).resolves.toEqual({});
  });

  it('still registers tools from healthy servers when some discovery errors are reported', async () => {
    const listTools = vi.fn(async () => ({
      servers: [
        {
          serverId: 'filesystem',
          serverName: 'Filesystem',
          tools: [{ name: 'read_file', inputSchema: { type: 'object' } }],
        },
      ],
      errors: [
        {
          serverId: 'broken',
          serverName: 'Broken',
          error: 'MCP stdio transport is disabled on this API server.',
        },
      ],
    }));

    const functions = await createMcpClientFunctions({
      servers: [filesystemServer],
      listTools,
      callTool: vi.fn(),
    });

    expect(Object.keys(functions)).toHaveLength(1);
    expect(functions[toMcpFunctionName('filesystem', 'read_file')]).toBeDefined();
  });

  it('maps nullable JSON Schema types and anyOf object branches into Gemini schemas', async () => {
    const listTools = vi.fn(async () => ({
      servers: [
        {
          serverId: 'filesystem',
          serverName: 'Filesystem',
          tools: [
            {
              name: 'write_file',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: ['string', 'null'], description: 'Target path' },
                  payload: {
                    anyOf: [
                      {
                        type: 'object',
                        properties: { text: { type: 'string' } },
                        required: ['text'],
                      },
                      { type: 'null' },
                    ],
                  },
                },
                required: ['path'],
              },
            },
          ],
        },
      ],
      errors: [],
    }));

    const functions = await createMcpClientFunctions({
      servers: [filesystemServer],
      listTools,
      callTool: vi.fn(),
    });
    const declaration = functions[toMcpFunctionName('filesystem', 'write_file')].declaration;

    expect(declaration.parameters).toMatchObject({
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: 'Target path (nullable)',
        },
        payload: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
          },
          required: ['text'],
        },
      },
      required: ['path'],
    });
  });
});
