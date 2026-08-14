import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { SUGGESTION_CHIP_CLASS } from '@/constants/designTokens';

const chatSuggestionsPath = path.resolve(__dirname, './ChatSuggestions.tsx');
const suggestionIconPath = path.resolve(__dirname, './SuggestionIcon.tsx');

describe('ChatSuggestions button sizing', () => {
  it('uses shared design-token chip padding (compact vs default controls)', () => {
    const source = fs.readFileSync(chatSuggestionsPath, 'utf8');

    expect(source).toContain('SUGGESTION_CHIP_CLASS');
    expect(SUGGESTION_CHIP_CLASS).toContain(
      'gap-[0.3rem] sm:gap-[0.4rem] px-[0.6rem] py-[0.4rem] sm:px-[0.8rem] sm:py-[0.5rem]',
    );
    expect(SUGGESTION_CHIP_CLASS).not.toContain('gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5');
    expect(SUGGESTION_CHIP_CLASS).not.toContain('shadow-sm');
  });

  it('uses twenty-percent smaller suggestion icons', () => {
    const source = fs.readFileSync(suggestionIconPath, 'utf8');

    expect(source).toContain('const size = 13;');
    expect(source).not.toContain('const size = 16;');
  });
});
