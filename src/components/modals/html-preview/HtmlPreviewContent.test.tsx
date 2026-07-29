import React, { act } from 'react';
import { setupTestRenderer } from '@/test/render/renderer';
import { describe, expect, it } from 'vitest';
import { HtmlPreviewContent } from './HtmlPreviewContent';

describe('HtmlPreviewContent', () => {
  const renderer = setupTestRenderer();

  it('renders the iframe with an unrestricted sandbox and bridged srcDoc content', () => {
    const iframeRef = React.createRef<HTMLIFrameElement>();
    const htmlWithScript =
      '<html><head><script src="https://cdn.example/app.js"></script></head><body><button onclick="run()">Hello</button></body></html>';

    act(() => {
      renderer.root.render(<HtmlPreviewContent iframeRef={iframeRef} htmlContent={htmlWithScript} scale={1} />);
    });

    const iframe = renderer.container.querySelector('iframe');
    const sandbox = iframe?.getAttribute('sandbox') ?? '';
    const srcDoc = iframe?.getAttribute('srcdoc') ?? '';

    expect(sandbox.split(/\s+/)).toEqual(
      expect.arrayContaining([
        'allow-scripts',
        'allow-same-origin',
        'allow-forms',
        'allow-popups',
        'allow-modals',
        'allow-downloads',
      ]),
    );
    // Unrestricted: keep model scripts/handlers and do not inject a CSP.
    expect(srcDoc).toContain('cdn.example/app.js');
    expect(srcDoc).toContain('onclick="run()"');
    expect(srcDoc).not.toContain('Content-Security-Policy');
    expect(srcDoc).toContain('parent.postMessage');
  });
});
