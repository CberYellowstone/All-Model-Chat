export type McpServerTransport = 'stdio' | 'http';

export interface McpServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  transport: McpServerTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpClientBridge {
  listTools(server: McpServerConfig): Promise<McpTool[]>;
  callTool(server: McpServerConfig, toolName: string, args: Record<string, unknown>): Promise<unknown>;
}
