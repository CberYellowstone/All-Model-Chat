import { describe, expect, it } from 'vitest';
import { readSourceFile } from './architectureTestUtils';

describe('UI clarity regressions', () => {
  it('keeps popup menus free of zoom-based entry transforms', () => {
    const popupFiles = [
      'components/shared/Select.tsx',
      'components/chat/input/AttachmentMenu.tsx',
      'components/chat/input/ToolsMenu.tsx',
      'components/message/blocks/TableBlock.tsx',
      'components/message/code/InlineCode.tsx',
      'components/modals/HelpModal.tsx',
      'components/modals/AudioRecorder.tsx',
      'components/modals/CreateTextFileEditor.tsx',
      'components/modals/create-file/CreateFileBody.tsx',
      'components/message/content/thoughts/ThinkingActions.tsx',
      'components/settings/controls/model-selector/ModelListView.tsx',
    ];

    for (const relativePath of popupFiles) {
      const source = readSourceFile(relativePath);

      expect(source).not.toContain('zoom-in');
      expect(source).not.toContain('zoom-in-95');
    }
  });

  it('keeps tooltip and small floating controls off scale transforms', () => {
    const tooltipStyles = readSourceFile('styles/main.css');
    const selectedFileDisplay = readSourceFile('components/chat/input/SelectedFileDisplay.tsx');
    const sessionItem = readSourceFile('components/sidebar/SessionItem.tsx');
    const codeBlock = readSourceFile('components/message/blocks/CodeBlock.tsx');

    expect(tooltipStyles).not.toContain('translateX(-50%) scale(0.95)');
    expect(tooltipStyles).not.toContain('translateX(-50%) scale(1)');
    expect(selectedFileDisplay).not.toContain('scale-90 hover:scale-100');
    expect(sessionItem).not.toContain('scale-95 bg-[var(--theme-bg-tertiary)]');
    expect(codeBlock).not.toContain('group-hover/expand:scale-105');
  });

  it('avoids heavy backdrop blur on compact floating toolbars and affordances', () => {
    const files = [
      'components/shared/file-preview/FloatingToolbar.tsx',
      'components/chat/input/area/ChatSuggestions.tsx',
      'components/chat/input/SelectedFileDisplay.tsx',
      'components/pwa/PwaUpdateBanner.tsx',
      'components/message/blocks/CodeBlock.tsx',
      'components/message/blocks/TableBlock.tsx',
      'components/modals/HelpModal.tsx',
      'components/message/blocks/parts/DiagramWrapper.tsx',
      'components/scenarios/PreloadedMessagesModal.tsx',
      'components/message/blocks/parts/CodeHeader.tsx',
      'components/chat/overlays/DragDropOverlay.tsx',
      'components/scenarios/editor/ScenarioMessageInput.tsx',
      'components/chat/message-list/ScrollNavigation.tsx',
      'components/message/FileDisplay.tsx',
      'components/shared/file-preview/pdf-viewer/PdfSidebar.tsx',
      'components/shared/file-preview/pdf-viewer/PdfMainContent.tsx',
      'components/shared/file-preview/TextFileViewer.tsx',
      'components/modals/FilePreviewModal.tsx',
      'components/chat/input/LiveStatusBanner.tsx',
    ];

    for (const relativePath of files) {
      const source = readSourceFile(relativePath);

      expect(source).not.toContain('backdrop-blur-xl');
      expect(source).not.toContain('backdrop-blur-md');
      expect(source).not.toContain('backdrop-blur-sm');
    }
  });

  it('keeps diagram blocks visually aligned with code blocks', () => {
    const codeBlock = readSourceFile('components/message/blocks/CodeBlock.tsx');
    const codeHeader = readSourceFile('components/message/blocks/parts/CodeHeader.tsx');
    const diagramWrapper = readSourceFile('components/message/blocks/parts/DiagramWrapper.tsx');

    expect(codeBlock).toContain('border border-[var(--theme-border-primary)]');
    expect(codeBlock).toContain('bg-[var(--theme-bg-code-block)]');
    expect(codeHeader).toContain('bg-[var(--theme-bg-code-block-header)]');

    expect(diagramWrapper).toContain('border border-[var(--theme-border-primary)]');
    expect(diagramWrapper).toContain('bg-[var(--theme-bg-code-block)]');
    expect(diagramWrapper).toContain('bg-[var(--theme-bg-code-block-header)]');
    expect(diagramWrapper).not.toContain('border-[var(--theme-border-secondary)] border-b-0');
    expect(diagramWrapper).not.toContain('bg-[var(--theme-bg-tertiary)]/45');
  });

  it('uses dynamic viewport height for the app root to avoid mobile browser chrome jumps', () => {
    const mainStyles = readSourceFile('styles/main.css');

    expect(mainStyles).toContain('height: 100dvh;');
    expect(mainStyles).toContain('@supports not (height: 100dvh)');
  });

  it('keeps virtualized code blocks from animating height changes while scrolling', () => {
    const codeBlock = readSourceFile('components/message/blocks/CodeBlock.tsx');

    expect(codeBlock).not.toContain("transition: 'max-height");
    expect(codeBlock).not.toContain('transition: max-height');
  });
});
