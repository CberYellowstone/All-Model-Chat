import type { IncomingMessage, ServerResponse } from 'node:http';
import net from 'node:net';
import { sendJson } from './cors.js';
import type { McpClientBridge, McpServerConfig, McpTool } from './mcpTypes.js';

const MCP_TOOLS_PATH = '/api/mcp/tools';
const MCP_CALL_PATH = '/api/mcp/call';

const MAX_MCP_REQUEST_BYTES = 1024 * 1024;

interface McpRouteOptions {
  enableStdio: boolean;
  enablePrivateHttp: boolean;
}

type McpServerParseResult =
  | {
      ok: true;
      server: McpServerConfig;
    }
  | {
      ok: false;
      error?: {
        serverId: string;
        serverName: string;
        error: string;
      };
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_MCP_REQUEST_BYTES) {
      throw new Error('MCP request body is too large.');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString('utf8');
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const rawBody = await readRequestBody(request);
  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new SyntaxError('MCP request body must be valid JSON.');
  }
};

const sanitizeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
};

const sanitizeStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const isValidMcpHttpUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

const isPrivateMcpHttpHostname = (hostname: string): boolean => {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  const ipVersion = net.isIP(normalizedHostname);

  if (ipVersion === 4) {
    const [first, second] = normalizedHostname.split('.').map((part) => Number(part));
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254) ||
      first === 0
    );
  }

  if (ipVersion === 6) {
    const lower = normalizedHostname.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }

  return ['localhost', 'localhost.localdomain'].includes(normalizedHostname.toLowerCase());
};

const isPrivateMcpHttpUrl = (value: string): boolean => {
  try {
    return isPrivateMcpHttpHostname(new URL(value).hostname);
  } catch {
    return false;
  }
};

const parseMcpServer = (value: unknown, options: McpRouteOptions): McpServerParseResult => {
  if (!isRecord(value)) {
    return { ok: false };
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const enabled = value.enabled === true;
  const transport = value.transport;
  if (!id || !name || (transport !== 'stdio' && transport !== 'http')) {
    return { ok: false };
  }

  const server: McpServerConfig = {
    id,
    name,
    enabled,
    transport,
  };

  if (!enabled) {
    return { ok: true, server };
  }

  if (transport === 'stdio') {
    const command = typeof value.command === 'string' ? value.command.trim() : '';
    if (!command) {
      return { ok: false };
    }

    server.command = command;
    const args = sanitizeStringArray(value.args);
    const env = sanitizeStringRecord(value.env);
    if (args) server.args = args;
    if (env) server.env = env;
    return { ok: true, server };
  }

  const url = typeof value.url === 'string' ? value.url.trim() : '';
  if (!url) {
    return { ok: false };
  }

  if (!isValidMcpHttpUrl(url)) {
    return {
      ok: false,
      error: {
        serverId: id,
        serverName: name,
        error: 'MCP HTTP server URL must use http:// or https://.',
      },
    };
  }

  if (!options.enablePrivateHttp && isPrivateMcpHttpUrl(url)) {
    return {
      ok: false,
      error: {
        serverId: id,
        serverName: name,
        error: 'Private MCP HTTP server URLs are disabled on this API server.',
      },
    };
  }

  server.url = url;
  const headers = sanitizeStringRecord(value.headers);
  if (headers) server.headers = headers;
  return { ok: true, server };
};

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const handleListTools = async (
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
  mcpClient: McpClientBridge,
  options: McpRouteOptions,
): Promise<void> => {
  const body = await readJsonBody(request);
  const rawServers = isRecord(body) && Array.isArray(body.servers) ? body.servers : null;
  if (!rawServers) {
    sendJson(request, response, 400, { error: 'MCP servers must be provided.' }, allowedOrigins);
    return;
  }

  const parsedServers = rawServers.map((server) => parseMcpServer(server, options));
  const enabledServers = parsedServers
    .filter((result): result is { ok: true; server: McpServerConfig } => result.ok && result.server.enabled)
    .map((result) => result.server);
  const servers: Array<{ serverId: string; serverName: string; tools: McpTool[] }> = [];
  const errors: Array<{ serverId: string; serverName: string; error: string }> = parsedServers.flatMap((result) =>
    !result.ok && result.error ? [result.error] : [],
  );

  for (const server of enabledServers) {
    if (server.transport === 'stdio' && !options.enableStdio) {
      errors.push({
        serverId: server.id,
        serverName: server.name,
        error: 'MCP stdio transport is disabled on this API server.',
      });
      continue;
    }

    try {
      servers.push({
        serverId: server.id,
        serverName: server.name,
        tools: await mcpClient.listTools(server),
      });
    } catch (error) {
      errors.push({
        serverId: server.id,
        serverName: server.name,
        error: getErrorMessage(error),
      });
    }
  }

  sendJson(request, response, 200, { servers, errors }, allowedOrigins);
};

const handleCallTool = async (
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
  mcpClient: McpClientBridge,
  options: McpRouteOptions,
): Promise<void> => {
  const body = await readJsonBody(request);
  if (!isRecord(body)) {
    sendJson(request, response, 400, { error: 'MCP request body must be an object.' }, allowedOrigins);
    return;
  }

  const parsedServer = parseMcpServer(body.server, options);
  const toolName = typeof body.toolName === 'string' ? body.toolName.trim() : '';
  const args = isRecord(body.args) ? body.args : {};
  if (!parsedServer.ok) {
    sendJson(
      request,
      response,
      400,
      { error: parsedServer.error?.error ?? 'MCP server and tool name are required.' },
      allowedOrigins,
    );
    return;
  }

  const { server } = parsedServer;
  if (!server.enabled || !toolName) {
    sendJson(request, response, 400, { error: 'MCP server and tool name are required.' }, allowedOrigins);
    return;
  }

  if (server.transport === 'stdio' && !options.enableStdio) {
    sendJson(request, response, 403, { error: 'MCP stdio transport is disabled on this API server.' }, allowedOrigins);
    return;
  }

  const result = await mcpClient.callTool(server, toolName, args);
  sendJson(request, response, 200, { result: result as Record<string, unknown> }, allowedOrigins);
};

export const handleMcpRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  allowedOrigins: string[],
  mcpClient: McpClientBridge,
  options: McpRouteOptions = { enableStdio: false, enablePrivateHttp: false },
): Promise<boolean> => {
  if (path !== MCP_TOOLS_PATH && path !== MCP_CALL_PATH) {
    return false;
  }

  if (request.method !== 'POST') {
    sendJson(request, response, 405, { error: 'Method not allowed' }, allowedOrigins);
    return true;
  }

  try {
    if (path === MCP_TOOLS_PATH) {
      await handleListTools(request, response, allowedOrigins, mcpClient, options);
    } else {
      await handleCallTool(request, response, allowedOrigins, mcpClient, options);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(request, response, 400, { error: error.message }, allowedOrigins);
      return true;
    }

    sendJson(request, response, 500, { error: `MCP request failed: ${getErrorMessage(error)}` }, allowedOrigins);
  }

  return true;
};
