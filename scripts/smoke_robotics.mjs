#!/usr/bin/env node
/**
 * Smoke test for the Gemini Robotics ER 2 pointing endpoint.
 *
 * Uploads a test image and asks the model to point to objects, asserting the
 * response is a JSON array where every item has:
 *   - point: integer [y, x] pair normalized to 0-1000
 *   - label: non-empty string
 *
 * Prerequisites (see README):
 *   - GEMINI_API_KEY set and restricted in AI Studio (unrestricted keys
 *     return 403 Forbidden for Robotics models).
 *   - Optional GEMINI_API_BASE for a custom endpoint/proxy.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/smoke_robotics.mjs
 *   GEMINI_API_KEY=... GEMINI_API_BASE=... node scripts/smoke_robotics.mjs [image-path]
 *
 * Exit code: 0 = all checks passed, 1 = any check failed, 2 = usage/API error.
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';

const MODEL = process.env.ROBOTICS_MODEL ?? 'gemini-robotics-er-2-preview';
const DEFAULT_IMAGE = new URL('../public/app-logo.png', import.meta.url).pathname;

const PROMPT = `
Point to no more than 10 items in the image. The label returned
should be an identifying name for the object detected.
The answer should follow the json format: [{"point": [y, x], "label": <label>}, ...].
The points are in [y, x] format normalized to 0-1000.
`;

// JSON schema for structured output: array of { point: [y, x], label: string }.
const responseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      point: {
        type: 'array',
        items: { type: 'integer' },
        minItems: 2,
        maxItems: 2,
      },
      label: { type: 'string' },
    },
    required: ['point', 'label'],
    additionalProperties: false,
  },
};

function fail(message) {
  console.error(`✗ FAIL: ${message}`);
  process.exitCode = 1;
}

function parsePoints(rawText) {
  const match = rawText.match(/\[[\s\S]*\]/);
  if (!match) return { ok: false, error: `no JSON array found in response: ${rawText.slice(0, 200)}` };
  try {
    return { ok: true, items: JSON.parse(match[0]) };
  } catch (err) {
    return { ok: false, error: `JSON parse error: ${err.message}` };
  }
}

async function main() {
  const imagePath = process.argv[2] ?? DEFAULT_IMAGE;
  if (!fs.existsSync(imagePath)) {
    fail(`image not found: ${imagePath}`);
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set (required; must be restricted in AI Studio for Robotics models).');
    process.exit(2);
  }

  const client = new GoogleGenAI({ apiKey, baseUrl: process.env.GEMINI_API_BASE });

  console.log(`Model: ${MODEL}`);
  console.log(`Image: ${imagePath}`);

  let uploaded;
  try {
    uploaded = await client.files.upload({ file: imagePath });
    console.log(`Uploaded: ${uploaded.uri}`);
  } catch (err) {
    fail(`file upload failed: ${err.message}`);
    return;
  }

  let response;
  try {
    response = await client.interactions.create({
      model: MODEL,
      input: [
        { type: 'image', uri: uploaded.uri, mime_type: uploaded.mime_type },
        { type: 'text', text: PROMPT },
      ],
      generation_config: {
        thinking_config: { thinking_level: 'medium' },
        response_schema: responseSchema,
        response_mime_type: 'application/json',
      },
    });
  } catch (err) {
    fail(`interactions.create failed: ${err.message}`);
    return;
  }

  const text = response.output_text ?? '';
  const { ok, items } = parsePoints(text);
  if (!ok) {
    fail(items.error);
    return;
  }
  if (!Array.isArray(items)) {
    fail(`response is not an array: ${JSON.stringify(items).slice(0, 200)}`);
    return;
  }

  let pass = 0;
  const output = [];
  for (const item of items) {
    const problems = [];
    if (!Array.isArray(item?.point) || item.point.length !== 2) {
      problems.push('point is not a [y, x] pair');
    } else {
      const [y, x] = item.point;
      if (!Number.isInteger(y) || !Number.isInteger(x)) problems.push(`point [${y}, ${x}] is not integer`);
      if (y < 0 || y > 1000 || x < 0 || x > 1000) problems.push(`point [${y}, ${x}] out of 0-1000 range`);
    }
    if (typeof item?.label !== 'string' || item.label.trim() === '') {
      problems.push('label is empty');
    }
    const itemPass = problems.length === 0;
    if (itemPass) pass += 1;
    output.push(
      `${itemPass ? '✓' : '✗'} point=[${item?.point?.join(', ') ?? 'n/a'}] label="${item?.label ?? ''}"${
        problems.length ? `  (${problems.join('; ')})` : ''
      }`,
    );
  }

  console.log('\n--- items ---');
  console.log(output.join('\n'));
  console.log(`\npassed ${pass}/${items.length} items, ${items.length} total`);

  if (items.length === 0) {
    fail('response contains no items');
  }
  if (pass !== items.length) {
    fail(`${items.length - pass} item(s) failed validation`);
  }
}

main().catch((err) => {
  console.error(`✗ unhandled error: ${err.stack ?? err}`);
  process.exit(2);
});
