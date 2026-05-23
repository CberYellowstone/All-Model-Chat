import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { listProjectSourceFiles, projectRoot, readProjectFile } from './projectFiles';

describe('source readability boundaries', () => {
  it('keeps chat input context type contracts out of the context runtime module', () => {
    const contextSource = readProjectFile('src/components/chat/input/ChatInputContext.tsx');
    const contextTypesSource = readProjectFile('src/components/chat/input/chatInputContextTypes.ts');

    expect(contextSource).toContain("from './chatInputContextTypes'");
    expect(contextSource).not.toContain('interface ChatInputRuntimeState');
    expect(contextSource).not.toContain('interface ChatInputState');
    expect(contextSource).not.toContain('interface ChatInputHandlers');
    expect(contextTypesSource).toContain('export interface ChatInputContextValue');
    expect(contextTypesSource).toContain('export interface ChatInputActionsContextValue');
    expect(contextSource.length).toBeLessThan(3500);
  });

  it('models language badge entries directly instead of through an identity helper', () => {
    const source = readProjectFile('src/components/message/code/LanguageIcon.tsx');

    expect(source).toContain('satisfies LanguageBadgeEntry[]');
    expect(source).not.toContain('const languageBadge =');
    expect(source).not.toContain('languageBadge({');
  });

  it('keeps architecture guard tests on the shared filesystem helpers', () => {
    const utilitySource = readProjectFile('src/test/architecture/projectFiles.ts');
    const architectureTests = listProjectSourceFiles('src/test/architecture').filter(
      (relativePath) =>
        relativePath.endsWith('.test.ts') &&
        relativePath !== 'src/test/architecture/sourceReadabilityBoundaries.test.ts',
    );
    const localHelperOffenders = architectureTests.filter((relativePath) => {
      const source = readProjectFile(relativePath);
      return (
        source.includes("const projectRoot = path.resolve(__dirname, '../../..');") ||
        source.includes('const readProjectFile =')
      );
    });

    expect(fs.existsSync(path.join(projectRoot, 'src/test/architecture/architectureTestUtils.ts'))).toBe(false);
    expect(utilitySource).toContain('.sort(');
    expect(localHelperOffenders).toEqual([]);
  });

  it('keeps UI comments from narrating obvious markup sections', () => {
    const appEntrySource = readProjectFile('src/index.tsx');
    const sendControlsSource = readProjectFile('src/components/chat/input/actions/SendControls.tsx');
    const codeBlockSource = readProjectFile('src/components/message/blocks/CodeBlock.tsx');
    const consoleTabSource = readProjectFile('src/components/log-viewer/ConsoleTab.tsx');
    const modelPickerSource = readProjectFile('src/components/shared/ModelPicker.tsx');
    const groupItemSource = readProjectFile('src/components/sidebar/GroupItem.tsx');
    const pdfMainContentSource = readProjectFile('src/components/shared/file-preview/pdf-viewer/PdfMainContent.tsx');
    const preloadedMessagesModalSource = readProjectFile('src/components/scenarios/PreloadedMessagesModal.tsx');
    const dataManagementSectionSource = readProjectFile('src/components/settings/sections/DataManagementSection.tsx');

    expect(appEntrySource).not.toContain('Import Global Styles');

    for (const phrase of ['{/* Cancel Edit Button', '{/* Main Action Button', '{/* Ripples */}', '{/* Icons stack']) {
      expect(sendControlsSource).not.toContain(phrase);
    }

    expect(codeBlockSource).not.toContain('Extract raw code for execution');
    expect(codeBlockSource).not.toContain('Execution Props');
    expect(codeBlockSource).not.toContain('Execution Console');
    expect(consoleTabSource).not.toContain('{/* List */}');
    expect(consoleTabSource).not.toContain('{/* Load More Trigger */}');
    expect(modelPickerSource).not.toContain('Render props for the trigger button');
    expect(groupItemSource).not.toContain('Define a type for the props that are passed down to SessionItem');
    expect(pdfMainContentSource).not.toContain('PDF Content');
    expect(pdfMainContentSource).not.toContain('Loading Indicator');
    expect(pdfMainContentSource).not.toContain('Error Indicator');
    expect(preloadedMessagesModalSource).not.toContain('Modal Header');
    expect(preloadedMessagesModalSource).not.toContain('Feedback Toast');
    expect(preloadedMessagesModalSource).not.toContain('Content Area');
    expect(dataManagementSectionSource).not.toContain('DANGER ZONE');
  });

  it('does not pass literal fallbacks for translation keys that already exist', () => {
    const sendControlsSource = readProjectFile('src/components/chat/input/actions/SendControls.tsx');

    expect(sendControlsSource).not.toContain("t('sendMessage_fast_suffix',");
  });

  it('names shared error boundary contracts after the component', () => {
    const errorBoundarySource = readProjectFile('src/components/shared/ErrorBoundary.tsx');

    expect(errorBoundarySource).toContain('interface ErrorBoundaryProps');
    expect(errorBoundarySource).toContain('interface ErrorBoundaryState');
    expect(errorBoundarySource).not.toContain('interface Props');
    expect(errorBoundarySource).not.toContain('interface State');
  });

  it('keeps session loading comments focused on why instead of narrating steps', () => {
    const sessionLoaderSource = readProjectFile('src/hooks/chat/history/useSessionLoader.ts');

    for (const phrase of [
      'Set Active Messages and ID',
      'Ensure metadata list contains this session',
      'Update metadata if needed',
      'Restore files from draft',
      'Fetch metadata only for the list',
      'Determine Active Session ID',
      'Set List State',
      'MEMORY OPTIMIZATION',
      'Fallback: New Chat',
      'Pass the top session',
    ]) {
      expect(sessionLoaderSource).not.toContain(phrase);
    }
  });
});
