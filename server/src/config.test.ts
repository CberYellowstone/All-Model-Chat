// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('keeps MCP stdio and private HTTP disabled unless explicitly enabled', () => {
    const config = loadConfig({});

    expect(config.enableMcpStdio).toBe(false);
    expect(config.enableMcpPrivateHttp).toBe(false);
  });

  it('parses MCP transport enablement flags from the environment', () => {
    const config = loadConfig({
      ENABLE_MCP_STDIO: 'true',
      ENABLE_MCP_PRIVATE_HTTP: 'yes',
    });

    expect(config.enableMcpStdio).toBe(true);
    expect(config.enableMcpPrivateHttp).toBe(true);
  });
});
