import { describe, expect, it } from 'vitest';
import { CODE_EXECUTION_TEXT_FILE_LIMIT_BYTES, isServerCodeExecutionMode } from './codeExecution';

describe('code execution settings helpers', () => {
  it('treats Gemini code execution as server-side only when local Python is disabled', () => {
    expect(isServerCodeExecutionMode({ isCodeExecutionEnabled: true, isLocalPythonEnabled: false })).toBe(true);
    expect(isServerCodeExecutionMode({ isCodeExecutionEnabled: true, isLocalPythonEnabled: true })).toBe(false);
    expect(isServerCodeExecutionMode({ isCodeExecutionEnabled: false, isLocalPythonEnabled: false })).toBe(false);
  });

  it('keeps the text file limit aligned with the Gemini code execution policy', () => {
    expect(CODE_EXECUTION_TEXT_FILE_LIMIT_BYTES).toBe(2 * 1024 * 1024);
  });

  it('never treats a third-party session as server-side code execution even if the toggle stayed on', () => {
    expect(
      isServerCodeExecutionMode({ isCodeExecutionEnabled: true, isLocalPythonEnabled: false, apiMode: 'third-party' }),
    ).toBe(false);
    expect(
      isServerCodeExecutionMode({
        isCodeExecutionEnabled: true,
        isLocalPythonEnabled: false,
        apiMode: 'third-party',
        isThirdPartyApiEnabled: true,
      }),
    ).toBe(false);
  });

  it('honors app-level third-party settings where the enable flag is present', () => {
    // Flag present and true + apiMode third-party → not active.
    expect(
      isServerCodeExecutionMode({
        isCodeExecutionEnabled: true,
        isLocalPythonEnabled: false,
        apiMode: 'third-party',
        isThirdPartyApiEnabled: true,
      }),
    ).toBe(false);

    // Flag present but false → the provider is not actually active → code execution stays on.
    expect(
      isServerCodeExecutionMode({
        isCodeExecutionEnabled: true,
        isLocalPythonEnabled: false,
        apiMode: 'third-party',
        isThirdPartyApiEnabled: false,
      }),
    ).toBe(true);
  });

  it('keeps Gemini-native mode behavior unchanged', () => {
    expect(
      isServerCodeExecutionMode({
        isCodeExecutionEnabled: true,
        isLocalPythonEnabled: false,
        apiMode: 'gemini-native',
      }),
    ).toBe(true);
  });
});
