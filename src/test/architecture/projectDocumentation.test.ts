import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { projectRoot, readProjectFile } from './projectFiles';

describe('project documentation structure', () => {
  it('keeps the shared chat input selector in the focused storage constants module', () => {
    const settingsDefaults = readProjectFile('src/constants/settingsDefaults.ts');
    const storageKeys = readProjectFile('src/constants/storageKeys.ts');

    expect(settingsDefaults).not.toContain("export * from './storageKeys';");
    expect(storageKeys).toContain('export const CHAT_INPUT_TEXTAREA_SELECTOR');
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/domSelectors.ts'))).toBe(false);
  });

  it('documents the current source structure in both READMEs', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    for (const source of [zhReadme, enReadme]) {
      expect(source).toContain('src/features/');
      expect(source).toContain('src/i18n/');
      expect(source).toContain('src/pwa/');
      expect(source).toContain('src/schemas/');
      expect(source).toContain('src/test/');
      expect(source).toContain('local-python');
    }

    expect(zhReadme).not.toContain('Gemini / Pyodide / API / 日志等基础设施');
    expect(enReadme).not.toContain('Gemini, Pyodide, API, logging, and infrastructure services');
    expect(zhReadme).not.toContain('utils/                  # 导出、会话、IndexedDB');
    expect(enReadme).not.toContain('utils/                  # Export, session, IndexedDB');
  });

  it('distinguishes Docker runtime defaults from the static runtime-config template', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    expect(zhReadme).toContain('Docker 默认值');
    expect(zhReadme).toContain('public/runtime-config.js 模板');
    expect(enReadme).toContain('Docker default');
    expect(enReadme).toContain('public/runtime-config.js template');
  });

  it('documents the combined frontend and API build step for Docker Compose', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    expect(zhReadme).toContain('npm run build:docker');
    expect(enReadme).toContain('npm run build:docker');
  });

  it('serves module workers with a JavaScript MIME type in Docker', () => {
    const nginxConfig = readProjectFile('docker/nginx.conf');

    expect(nginxConfig).toMatch(/location\s+~\s+\\\.mjs\$/);
    expect(nginxConfig).toMatch(/types\s*\{[\s\S]*application\/javascript\s+[^;}]*\bmjs\b[\s\S]*\}/);
    expect(nginxConfig).toMatch(/location\s+~\s+\\\.mjs\$[\s\S]*Cache-Control "no-cache"/);
  });

  it('does not serve the SPA shell for missing hashed assets', () => {
    const nginxConfig = readProjectFile('docker/nginx.conf');

    expect(nginxConfig).toMatch(/location\s+\^~\s+\/assets\/[\s\S]*try_files\s+\$uri\s+=404/);
  });

  it('describes local Python package loading precisely', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    expect(zhReadme).toContain('预加载 numpy、pandas、matplotlib');
    expect(zhReadme).toContain('按需安装 scipy、scikit-learn');
    expect(zhReadme).not.toContain('预装 numpy、pandas、matplotlib、scipy、scikit-learn');

    expect(enReadme).toContain('Preloads numpy, pandas, and matplotlib');
    expect(enReadme).toContain('installs scipy and scikit-learn on demand');
    expect(enReadme).not.toContain(
      'Bundled scientific stack such as numpy, pandas, matplotlib, scipy, and scikit-learn',
    );
  });
});
