import { describe, expect, it } from 'vitest';
import { parseLiveArtifactInteractionSpec } from './liveArtifactInteraction';

describe('liveArtifactInteraction utilities', () => {
  it('accepts array enum fields for multi-select interaction state', () => {
    const interaction = {
      instruction: 'Continue with the selected channels.',
      schema: {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            title: 'Channels',
            items: {
              type: 'string',
              enum: ['email', 'social', 'blog'],
              enumNames: ['Email', 'Social', 'Blog'],
            },
            default: ['email', 'blog'],
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toMatchObject({
      schema: {
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'social', 'blog'],
              enumNames: ['Email', 'Social', 'Blog'],
            },
            default: ['email', 'blog'],
          },
        },
      },
    });
  });

  it('rejects array defaults outside the declared item options', () => {
    const interaction = {
      instruction: 'Continue with the selected channels.',
      schema: {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'social'],
            },
            default: ['email', 'video'],
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toBeNull();
  });

  it('accepts date and range formats on compatible interaction fields', () => {
    const interaction = {
      instruction: 'Continue with schedule and intensity.',
      schema: {
        type: 'object',
        properties: {
          dueDate: { type: 'string', format: 'date' },
          priority: { type: 'integer', format: 'range', minimum: 1, maximum: 5, default: 3 },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toMatchObject({
      schema: {
        properties: {
          dueDate: { type: 'string', format: 'date' },
          priority: { type: 'integer', format: 'range', minimum: 1, maximum: 5, default: 3 },
        },
      },
    });
  });

  it('rejects enum defaults that are outside the declared options', () => {
    const interaction = {
      instruction: 'Continue with the selected option.',
      schema: {
        type: 'object',
        properties: {
          tone: {
            type: 'string',
            enum: ['brief', 'detailed'],
            default: 'balanced',
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toBeNull();
  });

  it('rejects non-integer defaults and enum options for integer fields', () => {
    const interactionWithDecimalDefault = {
      instruction: 'Continue with the chosen count.',
      schema: {
        type: 'object',
        properties: {
          count: {
            type: 'integer',
            default: 1.5,
          },
        },
      },
    };
    const interactionWithDecimalEnum = {
      instruction: 'Continue with the chosen count.',
      schema: {
        type: 'object',
        properties: {
          count: {
            type: 'integer',
            enum: [1, 2.5],
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interactionWithDecimalDefault))).toBeNull();
    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interactionWithDecimalEnum))).toBeNull();
  });

  // Regression: the prompt historically demonstrated `"items":{"enum":[...]}`
  // without an `items.type`, and the old strict parser rejected the whole spec
  // — degrading the form to a plain code block. The parser now infers the
  // scalar type from the enum values when `items.type` is missing.
  const SPEC_WITHOUT_ITEMS_TYPE = JSON.stringify({
    instruction: '为了制定合适的重建方案，请先确认几个关键决策点（未选项将按保守默认值处理）。',
    submitLabel: '确认并生成方案',
    schema: {
      type: 'object',
      required: ['layoutStyle', 'featureScope', 'techStack', 'designDirection'],
      properties: {
        layoutStyle: {
          type: 'string',
          title: '① 页面布局风格',
          enum: ['单页一体化', '向导分步式', '卡片仪表盘式', '侧边栏导航式'],
        },
        featureScope: {
          type: 'array',
          title: '② 保留哪些现有功能（多选，未选的将被移除）',
          items: {
            enum: [
              '三种输入模式（URL / 本地路径 / ZIP上传）',
              '本地目录浏览器弹窗',
              '已保存路径预设',
              '包含/忽略 glob 模式',
              '输出格式选择（XML/Markdown/纯文本）',
              '输出选项勾选（摘要/目录/行号/压缩等）',
              '结果代码编辑器查看',
              '文件选择+重新打包',
              '打包并下载按钮',
              '页面状态持久化',
            ],
          },
        },
        techStack: { type: 'string', title: '③ 技术方案', enum: ['保持 Vue 3 + VitePress', '引入 UI 组件库'] },
        designDirection: { type: 'string', title: '④ 设计方向', enum: ['保持现有品牌风格', '全新现代极简风'] },
        priority: { type: 'string', title: '⑤ 重设计的首要目标', enum: ['视觉美观升级', '两者都要，全面重做'] },
        notes: { type: 'string', title: '补充说明（可选）', format: 'textarea' },
      },
    },
  });

  it('parses an array field that omits items.type (the shape the old prompt taught)', () => {
    const spec = parseLiveArtifactInteractionSpec(SPEC_WITHOUT_ITEMS_TYPE);

    expect(spec).not.toBeNull();
    expect(spec?.schema.properties.featureScope).toEqual({
      type: 'array',
      title: '② 保留哪些现有功能（多选，未选的将被移除）',
      items: {
        type: 'string',
        enum: expect.arrayContaining(['三种输入模式（URL / 本地路径 / ZIP上传）', '页面状态持久化']),
      },
    });
  });

  it('still rejects array items with no enum', () => {
    expect(
      parseLiveArtifactInteractionSpec(
        JSON.stringify({
          instruction: 'x',
          schema: { type: 'object', properties: { scope: { type: 'array', items: { type: 'string' } } } },
        }),
      ),
    ).toBeNull();
  });

  it('still rejects mixed-type enum values for array items', () => {
    expect(
      parseLiveArtifactInteractionSpec(
        JSON.stringify({
          instruction: 'x',
          schema: { type: 'object', properties: { scope: { type: 'array', items: { enum: ['a', 1] } } } },
        }),
      ),
    ).toBeNull();
  });
});
