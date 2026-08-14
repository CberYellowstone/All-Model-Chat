import { describe, expect, it } from 'vitest';
import { getModelCapabilities } from '@/utils/model/modelCapabilities';
import { getChatToolsForSurface, getSlashCommandToolDefinitions } from './toolRegistry';

describe('chat tool registry', () => {
  it('keeps toggleable tool ids, labels, slash commands, and settings keys in one registry', () => {
    expect(getSlashCommandToolDefinitions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'googleSearch',
          labelKey: 'webSearchLabel',
          shortLabelKey: 'webSearchShort',
          settingKey: 'isGoogleSearchEnabled',
          slashCommand: expect.objectContaining({ name: 'online', descriptionKey: 'helpCmdSearch' }),
        }),
        expect.objectContaining({
          id: 'codeExecution',
          settingKey: 'isCodeExecutionEnabled',
          slashCommand: expect.objectContaining({ name: 'code', descriptionKey: 'helpCmdCode' }),
        }),
      ]),
    );
  });

  it('drives slash-command tool definitions from the same registry as the toolbar menu', () => {
    expect(getSlashCommandToolDefinitions().map((tool) => tool.slashCommand?.name)).toEqual([
      'deep',
      'online',
      'maps',
      'code',
      'url',
    ]);
  });

  it('filters visible menu tools from permissions instead of model-name checks in components', () => {
    const liveCapabilities = getModelCapabilities('gemini-3.1-flash-live-preview');
    const geminiImageCapabilities = getModelCapabilities('gemini-3.1-flash-image-preview');
    const gemmaCapabilities = getModelCapabilities('gemma-3-27b-it');

    expect(
      getChatToolsForSurface({
        surface: 'tools-menu',
        capabilities: liveCapabilities,
        hasLocalPythonHandler: true,
      }).map((tool) => tool.id),
    ).toEqual(['localPython']);

    expect(
      getChatToolsForSurface({
        surface: 'tools-menu',
        capabilities: geminiImageCapabilities,
        hasLocalPythonHandler: true,
      }).map((tool) => tool.id),
    ).toEqual(['googleSearch', 'googleMaps', 'tokenCount']);

    expect(
      getChatToolsForSurface({
        surface: 'tools-menu',
        capabilities: gemmaCapabilities,
        hasLocalPythonHandler: true,
      }).map((tool) => tool.id),
    ).toEqual(['deepSearch', 'googleSearch', 'googleMaps', 'localPython', 'alwaysKeepThinking', 'tokenCount']);
  });

  it('hides the keep-thinking tool on Live, TTS, and image-generation models', () => {
    const liveCapabilities = getModelCapabilities('gemini-3.1-flash-live-preview');
    const geminiImageCapabilities = getModelCapabilities('gemini-3.1-flash-image-preview');
    const gemmaCapabilities = getModelCapabilities('gemma-3-27b-it');

    const idsFor = (capabilities: ReturnType<typeof getModelCapabilities>) =>
      getChatToolsForSurface({ surface: 'tools-menu', capabilities, hasLocalPythonHandler: true }).map(
        (tool) => tool.id,
      );

    expect(idsFor(liveCapabilities)).not.toContain('alwaysKeepThinking');
    expect(idsFor(geminiImageCapabilities)).not.toContain('alwaysKeepThinking');
    expect(idsFor(gemmaCapabilities)).toContain('alwaysKeepThinking');
  });
});
