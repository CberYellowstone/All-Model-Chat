import { Type, type Schema } from '@google/genai';
import type { McpServerConfig, StandardClientFunctions } from '@/types';
import { callMcpTool, fetchMcpTools, type McpToolDefinition, type McpToolsResponse } from '@/services/api/mcpApi';
import { logService } from '@/services/logService';
import { toMcpFunctionName } from './mcpToolNames';
import { isRecord } from '../../../shared/predicates';

interface CreateMcpClientFunctionsOptions {
  servers: McpServerConfig[];
  abortSignal?: AbortSignal;
  listTools?: (servers: McpServerConfig[], abortSignal?: AbortSignal) => Promise<McpToolsResponse>;
  callTool?: (
    server: McpServerConfig,
    toolName: string,
    args: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ) => Promise<unknown>;
}

const toSchemaType = (value: unknown): Type | undefined => {
  switch (value) {
    case 'object':
      return Type.OBJECT;
    case 'array':
      return Type.ARRAY;
    case 'string':
      return Type.STRING;
    case 'number':
      return Type.NUMBER;
    case 'integer':
      return Type.INTEGER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'null':
      return Type.NULL;
    default:
      return undefined;
  }
};

/** Pick the primary JSON Schema type when `type` is a string or array (e.g. ["string","null"]). */
const resolvePrimaryType = (schema: Record<string, unknown>): Type => {
  if (typeof schema.type === 'string') {
    return toSchemaType(schema.type) ?? Type.OBJECT;
  }

  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((item): item is string => typeof item === 'string');
    const nonNull = types.find((item) => item !== 'null');
    if (nonNull) {
      return toSchemaType(nonNull) ?? Type.OBJECT;
    }
    if (types.includes('null')) {
      return Type.NULL;
    }
  }

  // anyOf / oneOf / allOf — prefer the first object-like branch, else first branch.
  const union = schema.anyOf ?? schema.oneOf ?? schema.allOf;
  if (Array.isArray(union)) {
    const objectBranch = union.find(
      (branch) => isRecord(branch) && (branch.type === 'object' || isRecord(branch.properties)),
    );
    if (objectBranch) {
      return resolvePrimaryType(objectBranch as Record<string, unknown>);
    }
    const first = union.find(isRecord);
    if (first) {
      return resolvePrimaryType(first);
    }
  }

  // $ref without a resolved target — treat as opaque object.
  if (typeof schema.$ref === 'string') {
    return Type.OBJECT;
  }

  // Infer from structural keywords when type is missing.
  if (isRecord(schema.properties) || schema.additionalProperties !== undefined) {
    return Type.OBJECT;
  }
  if (schema.items !== undefined) {
    return Type.ARRAY;
  }

  return Type.OBJECT;
};

const pickUnionBranch = (schema: Record<string, unknown>): Record<string, unknown> | undefined => {
  const union = schema.anyOf ?? schema.oneOf ?? schema.allOf;
  if (!Array.isArray(union)) {
    return undefined;
  }

  const objectBranch = union.find(
    (branch) => isRecord(branch) && (branch.type === 'object' || isRecord(branch.properties)),
  );
  if (isRecord(objectBranch)) {
    return objectBranch;
  }

  const first = union.find(isRecord);
  return first;
};

const toGeminiSchema = (schema: unknown): Schema => {
  if (!isRecord(schema)) {
    return { type: Type.OBJECT };
  }

  // Unwrap a bare anyOf/oneOf when the parent has no own type.
  const unionBranch =
    schema.type === undefined && !isRecord(schema.properties) && schema.items === undefined
      ? pickUnionBranch(schema)
      : undefined;
  const effective = unionBranch ?? schema;

  const type = resolvePrimaryType(effective);
  const geminiSchema: Schema = {
    type,
  };

  if (typeof effective.description === 'string') {
    geminiSchema.description = effective.description;
  } else if (typeof schema.description === 'string') {
    geminiSchema.description = schema.description;
  }

  if (Array.isArray(effective.enum)) {
    const enumValues = effective.enum.filter((item): item is string => typeof item === 'string');
    if (enumValues.length > 0) {
      geminiSchema.enum = enumValues;
      geminiSchema.format = 'enum';
    }
  }
  if (typeof effective.format === 'string' && !geminiSchema.format) {
    geminiSchema.format = effective.format;
  }

  if (type === Type.OBJECT) {
    if (isRecord(effective.properties)) {
      geminiSchema.properties = Object.fromEntries(
        Object.entries(effective.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
      );
    }
    if (Array.isArray(effective.required)) {
      const required = effective.required.filter((item): item is string => typeof item === 'string');
      if (required.length > 0) {
        geminiSchema.required = required;
      }
    }
    // Gemini Schema supports additionalProperties as Schema | boolean in some versions;
    // map boolean true to an open object, false is default closed-ish.
    if (effective.additionalProperties === true) {
      geminiSchema.properties = geminiSchema.properties ?? {};
    } else if (isRecord(effective.additionalProperties)) {
      // Represent free-form maps as object with empty properties — best-effort for Gemini.
      geminiSchema.properties = geminiSchema.properties ?? {};
    }
  }

  if (type === Type.ARRAY && effective.items !== undefined) {
    geminiSchema.items = toGeminiSchema(effective.items);
  }

  // Nullable via type: ["string","null"] — Gemini uses nullable on some schemas; attach description note.
  if (Array.isArray(schema.type) && schema.type.includes('null') && type !== Type.NULL) {
    const baseDescription = geminiSchema.description ?? '';
    geminiSchema.description = baseDescription ? `${baseDescription} (nullable)` : 'Nullable value.';
  }

  return geminiSchema;
};

const buildDescription = (serverName: string, tool: McpToolDefinition): string => {
  const base = `MCP tool ${tool.name} from ${serverName}.`;
  return tool.description ? `${base} ${tool.description}` : base;
};

const makeRuntimeServerEntries = (
  servers: McpServerConfig[],
): Array<{ originalServer: McpServerConfig; runtimeServer: McpServerConfig }> => {
  const usedServerIds = new Set<string>();

  return servers.map((server) => {
    let runtimeId = server.id;
    let suffix = 2;
    while (usedServerIds.has(runtimeId)) {
      runtimeId = `${server.id}__${suffix}`;
      suffix += 1;
    }
    usedServerIds.add(runtimeId);

    return {
      originalServer: server,
      runtimeServer: runtimeId === server.id ? server : { ...server, id: runtimeId },
    };
  });
};

const formatDiscoveryErrors = (errors: Array<{ serverId: string; serverName: string; error: string }>): string =>
  errors.map((entry) => `${entry.serverName || entry.serverId}: ${entry.error}`).join('; ');

/**
 * Builds Gemini client function declarations for enabled MCP servers.
 * Never throws — discovery failures are logged and result in fewer/no tools so chat can continue.
 */
export const createMcpClientFunctions = async ({
  servers,
  abortSignal,
  listTools = fetchMcpTools,
  callTool = callMcpTool,
}: CreateMcpClientFunctionsOptions): Promise<StandardClientFunctions> => {
  const enabledServers = servers.filter((server) => server.enabled);
  if (enabledServers.length === 0) {
    return {};
  }

  try {
    const runtimeServerEntries = makeRuntimeServerEntries(enabledServers);
    const runtimeServers = runtimeServerEntries.map(({ runtimeServer }) => runtimeServer);
    const toolResponse = await listTools(runtimeServers, abortSignal);

    if (toolResponse.errors.length > 0) {
      logService.warn(`MCP tool discovery reported errors: ${formatDiscoveryErrors(toolResponse.errors)}`, {
        errors: toolResponse.errors,
      });
    }

    const serverByRuntimeId = new Map(
      runtimeServerEntries.map(({ originalServer, runtimeServer }) => [runtimeServer.id, originalServer]),
    );
    const functions: StandardClientFunctions = {};

    for (const serverTools of toolResponse.servers) {
      const server = serverByRuntimeId.get(serverTools.serverId);
      if (!server) {
        continue;
      }

      for (const tool of serverTools.tools) {
        const functionName = toMcpFunctionName(serverTools.serverId, tool.name);
        functions[functionName] = {
          declaration: {
            name: functionName,
            description: buildDescription(serverTools.serverName, tool),
            parameters: toGeminiSchema(tool.inputSchema),
          },
          handler: async (args, options) => ({
            response: await callTool(
              server,
              tool.name,
              isRecord(args) ? args : {},
              options?.abortSignal ?? abortSignal,
            ),
          }),
        };
      }
    }

    return functions;
  } catch (error) {
    logService.warn('MCP tool discovery failed; continuing chat without MCP tools.', { error });
    return {};
  }
};
