import type { Part, UsageMetadata } from '@google/genai';
import type { UploadedFile } from '@/types';
import { mergeGroundingMetadata, type MetadataWithCitations } from '@/utils/groundingMetadata';
import {
  appendApiPart,
  getContentDeltaFromPart,
  getGeneratedFileFromPart,
  mergeUniqueFiles,
} from './messageStreamParts';
import { mergeUsageMetadata, mergeUrlContextMetadata } from './messageStreamMetadata';

type MessageStreamEvent =
  | { type: 'part'; part: Part; receivedAt?: Date; recordFirstToken?: boolean }
  | { type: 'thought'; text: string; receivedAt?: Date; recordFirstToken?: boolean }
  | { type: 'files'; files: UploadedFile[]; receivedAt?: Date }
  | {
      type: 'complete';
      usage?: UsageMetadata;
      grounding?: unknown;
      urlContext?: unknown;
      generatedFiles?: UploadedFile[];
      aborted?: boolean;
      receivedAt?: Date;
    };

export interface MessageStreamState {
  generationId: string;
  generationStartTime: Date;
  content: string;
  thoughts: string;
  apiParts: Part[];
  files: UploadedFile[];
  firstTokenTimeMs?: number;
  firstContentPartTime: Date | null;
  lastThoughtChunkTimeMs?: number;
  lastContentPartTime?: Date;
  thinkingActive: boolean;
  usage?: UsageMetadata;
  grounding?: MetadataWithCitations;
  urlContext?: unknown;
  aborted: boolean;
}

export const createMessageStreamState = ({
  generationId,
  generationStartTime,
}: {
  generationId: string;
  generationStartTime: Date;
}): MessageStreamState => ({
  generationId,
  generationStartTime,
  content: '',
  thoughts: '',
  apiParts: [],
  files: [],
  firstContentPartTime: null,
  thinkingActive: false,
  aborted: false,
});

// A part counts as "thinking has ended" only when it visibly switches the
// turn to answering. Text and generated media end thinking; interleaved code
// execution is a tooling round-trip, so it keeps the thinking state alive so
// the thinking strip survives the round-trip and resumes if the model thinks
// again afterwards.
const isContentEndPart = (part: Part) => {
  const anyPart = part as Part & { text?: string; inlineData?: unknown };

  return Boolean((anyPart.text && anyPart.text.trim().length > 0) || anyPart.inlineData);
};

// Any part that can carry model output is a "token", but it must not end the
// thinking state (see isContentEndPart above).
const isTokenPart = (part: Part) => {
  const anyPart = part as Part & {
    text?: string;
    executableCode?: unknown;
    codeExecutionResult?: unknown;
    inlineData?: unknown;
  };

  return Boolean(
    (anyPart.text && anyPart.text.trim().length > 0) ||
    anyPart.executableCode ||
    anyPart.codeExecutionResult ||
    anyPart.inlineData,
  );
};

const recordFirstToken = (state: MessageStreamState, receivedAt?: Date): MessageStreamState => {
  if (state.firstTokenTimeMs !== undefined) {
    return state;
  }

  const now = receivedAt ?? new Date();
  return {
    ...state,
    firstTokenTimeMs: now.getTime() - state.generationStartTime.getTime(),
  };
};

const recordFirstContentPart = (state: MessageStreamState, receivedAt?: Date): MessageStreamState => {
  if (state.firstContentPartTime) {
    return state;
  }

  return {
    ...state,
    firstContentPartTime: receivedAt ?? new Date(),
  };
};

export const reduceMessageStreamEvent = (state: MessageStreamState, event: MessageStreamEvent): MessageStreamState => {
  // recordFirstToken:false marks a replay (non-streaming reply, tool-loop final
  // turn) whose parts all arrive at completion time. Such replays must not
  // advance the first-token timestamp or per-chunk thinking timings — those
  // would be stamped "now" and zero out the thinking-time display. They still
  // record the first content part so finalizeMessages can measure the total
  // run as the thinking duration.
  const isReplay = 'recordFirstToken' in event && event.recordFirstToken === false;

  switch (event.type) {
    case 'thought': {
      const receivedAt = event.receivedAt ?? new Date();
      if (isReplay) {
        return {
          ...state,
          thoughts: state.thoughts + event.text,
        };
      }

      return {
        ...recordFirstToken(state, receivedAt),
        thoughts: state.thoughts + event.text,
        lastThoughtChunkTimeMs: receivedAt.getTime() - state.generationStartTime.getTime(),
        thinkingActive: true,
      };
    }
    case 'part': {
      const receivedAt = event.receivedAt ?? new Date();
      let nextState = state;
      if (!isReplay && isTokenPart(event.part)) {
        nextState = recordFirstToken(state, receivedAt);
      }

      if (isContentEndPart(event.part)) {
        nextState = recordFirstContentPart(nextState, receivedAt);
      }

      const generatedFile = getGeneratedFileFromPart(event.part);

      return {
        ...nextState,
        content: nextState.content + getContentDeltaFromPart(event.part),
        apiParts: appendApiPart(nextState.apiParts, event.part),
        files: generatedFile ? mergeUniqueFiles(nextState.files, [generatedFile]) : nextState.files,
        // lastContentPartTime drives the mid-stream "thinking ended" commit; a
        // replay measures the whole run once at finalize instead.
        lastContentPartTime: !isReplay && isContentEndPart(event.part) ? receivedAt : nextState.lastContentPartTime,
        thinkingActive: !isReplay && isContentEndPart(event.part) ? false : nextState.thinkingActive,
      };
    }
    case 'files':
      return {
        ...state,
        files: mergeUniqueFiles(state.files, event.files),
      };
    case 'complete':
      return {
        ...state,
        usage: mergeUsageMetadata(state.usage, event.usage),
        grounding: mergeGroundingMetadata(state.grounding, event.grounding),
        urlContext: mergeUrlContextMetadata(state.urlContext, event.urlContext),
        files: event.generatedFiles ? mergeUniqueFiles(state.files, event.generatedFiles) : state.files,
        aborted: state.aborted || !!event.aborted,
      };
  }
};
