import type { McpServerConfig } from '@/types';

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpToolsResponse {
  servers: Array<{
    serverId: string;
    serverName: string;
    tools: McpToolDefinition[];
  }>;
  errors: Array<{
    serverId: string;
    serverName: string;
    error: string;
  }>;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : `MCP request failed with ${response.status}.`;
  } catch {
    return `MCP request failed with ${response.status}.`;
  }
};

export const fetchMcpTools = async (
  servers: McpServerConfig[],
  abortSignal?: AbortSignal,
): Promise<McpToolsResponse> => {
  const response = await fetch('/api/mcp/tools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ servers }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as McpToolsResponse;
};

export const callMcpTool = async (
  server: McpServerConfig,
  toolName: string,
  args: Record<string, unknown>,
  abortSignal?: AbortSignal,
): Promise<unknown> => {
  const response = await fetch('/api/mcp/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ server, toolName, args }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const body = (await response.json()) as { result?: unknown };
  return body.result;
};
