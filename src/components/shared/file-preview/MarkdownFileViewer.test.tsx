import { act } from 'react';
import { createProviderTestRenderer } from '@/test/render/providerRenderer';
import type { TestRenderer } from '@/test/render/renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadedFile } from '@/types';
import { MarkdownFileViewer } from './MarkdownFileViewer';

const { mockLazyMarkdownRenderer } = vi.hoisted(() => ({
  mockLazyMarkdownRenderer: vi.fn(({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">
      <h1>Preview title</h1>
      <h2>Section</h2>
      {content}
    </div>
  )),
}));

vi.mock('@/components/message/LazyMarkdownRenderer', () => ({
  LazyMarkdownRenderer: mockLazyMarkdownRenderer,
}));

describe('MarkdownFileViewer', () => {
  let container: HTMLDivElement;
  let root: TestRenderer;

  const createMarkdownFile = (id = 'markdown-file'): UploadedFile => ({
    id,
    name: 'notes.md',
    type: 'text/markdown',
    size: 128,
    uploadState: 'active',
    textContent: '# Preview title',
  });

  beforeEach(() => {
    root = createProviderTestRenderer({ providers: { language: 'en' } });
    container = root.container;
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('remembers source mode for the same markdown file when reopened', () => {
    const file = createMarkdownFile();

    act(() => {
      root.render(<MarkdownFileViewer file={file} content="# Preview title" />);
    });

    expect(container.querySelector('[data-testid="markdown-renderer"]')).not.toBeNull();

    const sourceButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Source'),
    );
    expect(sourceButton).toBeDefined();

    act(() => {
      sourceButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('# Preview title');
    expect(container.querySelector('[data-testid="markdown-renderer"]')).toBeNull();

    act(() => {
      root.unmount();
    });

    root = createProviderTestRenderer({ providers: { language: 'en' } });
    container = root.container;

    act(() => {
      root.render(<MarkdownFileViewer file={file} content="# Preview title" />);
    });

    expect(container.textContent).toContain('# Preview title');
    expect(container.querySelector('[data-testid="markdown-renderer"]')).toBeNull();
  });

  it('shows document stats and an outline toggle in preview mode', () => {
    const file = createMarkdownFile();

    act(() => {
      root.render(<MarkdownFileViewer file={file} content={'# Preview title\n\n## Section\n\nBody'} />);
    });

    expect(container.textContent).toContain('5 lines');
    expect(container.textContent).toContain('Outline');

    const outlineButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Outline'),
    );

    act(() => {
      outlineButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Document outline');
    expect(container.textContent).toContain('Section');
  });

  it('offers rich rendering for large markdown files', () => {
    const file = createMarkdownFile();
    const largeMarkdown = `${'# Heading\n\n'}${'Paragraph line\n'.repeat(5000)}`;

    act(() => {
      root.render(<MarkdownFileViewer file={file} content={largeMarkdown} />);
    });

    expect(container.querySelector('[data-testid="markdown-renderer"]')).toBeNull();
    expect(container.textContent).toContain('Large Markdown file detected');
    expect(container.textContent).toContain('Render Markdown anyway');

    const renderAnywayButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Render Markdown anyway'),
    );

    act(() => {
      renderAnywayButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="markdown-renderer"]')).not.toBeNull();
  });
});