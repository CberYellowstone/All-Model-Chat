import { escapeHtml } from '@/utils/escapeHtml';

export const generateExportHtmlTemplate = ({
  title,
  date,
  model,
  contentHtml,
  styles,
  themeId,
  language,
  rootBgColor,
  bodyClasses,
}: {
  title: string;
  date: string;
  model: string;
  contentHtml: string;
  styles: string;
  themeId: string;
  language: string;
  rootBgColor: string;
  bodyClasses: string;
}) => {
  const safeTitle = escapeHtml(title);
  const safeDate = escapeHtml(date);
  const safeModel = escapeHtml(model);
  const safeLanguage = escapeHtml(language);
  const safeThemeId = escapeHtml(themeId);
  const safeBodyClasses = escapeHtml(bodyClasses);
  // rootBgColor is interpolated into a CSS value inside a <style> block — escapeHtml
  // alone does not stop CSS breakout (no quotes to close), so validate it matches a
  // safe CSS color token; fall back to transparent otherwise.
  const safeRootBgColor =
    /^(#[0-9a-fA-F]{3,8}|rgb\([^()]*\)|rgba\([^()]*\)|hsl\([^()]*\)|hsla\([^()]*\)|oklch\([^()]*\)|transparent|currentColor|[a-z]+)$/i.test(
      rootBgColor.trim(),
    )
      ? rootBgColor.trim()
      : 'transparent';

  return `
        <!DOCTYPE html>
        <html lang="${safeLanguage}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Chat Export: ${safeTitle}</title>
            ${styles}
            <style>
                /* Reset & Layout */
                html, body { height: auto !important; overflow: auto !important; min-height: 100vh; }
                body {
                    background-color: ${safeRootBgColor};
                    padding: 2rem; 
                    box-sizing: border-box; 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: var(--theme-text-primary, #333);
                }
                
                /* Container */
                .exported-chat-container {
                    width: 100%;
                    max-width: 900px;
                    margin: 0 auto;
                    background-color: transparent;
                }

                /* Header Styles */
                .exported-chat-header { 
                    padding-bottom: 1.5rem; 
                    border-bottom: 1px solid var(--theme-border-secondary, #e5e7eb); 
                    margin-bottom: 2rem; 
                }
                .exported-chat-title { 
                    font-size: 1.75rem; 
                    font-weight: 700; 
                    color: var(--theme-text-primary, inherit); 
                    margin: 0 0 0.5rem 0; 
                    line-height: 1.2;
                }
                .exported-chat-meta { 
                    font-size: 0.875rem; 
                    color: var(--theme-text-tertiary, #6b7280); 
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                }

                /* UI Cleanup - Hide interactive elements */
                .message-actions, 
                .code-block-utility-button, 
                button, 
                .sticky,
                [role="tooltip"],
                input,
                textarea { 
                    display: none !important; 
                }

                /* Message Layout Fixes */
                [data-message-id] {
                    break-inside: avoid;
                    margin-bottom: 1.5rem;
                }
                [data-message-id]:last-child {
                    margin-bottom: 0;
                }
                
                /* Links */
                a { color: var(--theme-text-link, #2563eb); text-decoration: none; }
                a:hover { text-decoration: underline; }

                /* Tables */
                table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                th, td { 
                    border: 1px solid var(--theme-border-secondary, #e5e5e5); 
                    padding: 0.5rem 0.75rem; 
                    text-align: left; 
                }
                th { background-color: var(--theme-bg-tertiary, #f3f4f6); font-weight: 600; }

                /* Code Blocks */
                pre { 
                    background-color: var(--theme-bg-code-block, #f3f4f6); 
                    border-radius: 0.5rem; 
                    padding: 1rem; 
                    overflow-x: auto; 
                }
            </style>
        </head>
        <body class="${safeBodyClasses} theme-${safeThemeId} is-exporting-png">
            <div class="exported-chat-container">
                <div class="exported-chat-header">
                    <h1 class="exported-chat-title">${safeTitle}</h1>
                    <div class="exported-chat-meta">
                        <span>${safeDate}</span> • <span>${safeModel}</span>
                    </div>
                </div>
                ${contentHtml}
            </div>
        </body>
        </html>
    `;
};

export const generateExportTxtTemplate = ({
  title,
  date,
  model,
  messages,
}: {
  title: string;
  date: string;
  model: string;
  messages: Array<{ role: string; timestamp: Date; content: string; files?: Array<{ name: string }> }>;
}) => {
  const separator = '-'.repeat(40);

  const header = [`Chat: ${title}`, `Date: ${date}`, `Model: ${model}`, '='.repeat(40), ''].join('\n');

  const body = messages
    .map((message) => {
      const roleTitle = message.role.toUpperCase();
      const timestampText = new Date(message.timestamp).toLocaleString();
      let text = `### ${roleTitle} [${timestampText}]\n`;

      if (message.files && message.files.length > 0) {
        message.files.forEach((file) => {
          text += `[Attachment: ${file.name}]\n`;
        });
      }

      text += message.content;
      return text;
    })
    .join(`\n\n${separator}\n\n`);

  return header + body;
};
