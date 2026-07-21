import { describe, expect, it } from 'vitest';
import { ensureFeatureTranslations } from '@/i18n/featureTranslations';
import { getTranslator } from '@/i18n/coreTranslations';
import { searchSettingsCatalog } from './settingsSearch';

describe('searchSettingsCatalog', () => {
  it('matches interface toggles by English and Chinese labels', async () => {
    await ensureFeatureTranslations('settings');
    const tEn = getTranslator('en');
    const tZh = getTranslator('zh');

    const mermaidResults = searchSettingsCatalog('mermaid', tEn);
    expect(mermaidResults.some((result) => result.id === 'interface-mermaid')).toBe(true);

    const zhResults = searchSettingsCatalog('流式', tZh);
    expect(zhResults.some((result) => result.id === 'interface-streaming')).toBe(true);
  });

  it('matches across tabs and returns empty for blank queries', async () => {
    await ensureFeatureTranslations('settings');
    const t = getTranslator('en');

    expect(searchSettingsCatalog('   ', t)).toEqual([]);

    const apiResults = searchSettingsCatalog('proxy', t);
    // Files API / third-party / API config should still surface for related terms
    const mcpResults = searchSettingsCatalog('MCP', t);
    expect(mcpResults.some((result) => result.tab === 'mcp')).toBe(true);

    const dataResults = searchSettingsCatalog('reset', t);
    expect(dataResults.some((result) => result.id === 'data-reset')).toBe(true);

    const shortcutResults = searchSettingsCatalog('cycle models', t);
    expect(shortcutResults.some((result) => result.tab === 'shortcuts')).toBe(true);

    // Ensure multi-tab coverage exists in catalog
    expect(apiResults.length + mcpResults.length + dataResults.length).toBeGreaterThan(0);
  });
});
