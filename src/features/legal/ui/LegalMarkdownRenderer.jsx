import React from 'react';
import Markdown from 'react-markdown';

/**
 * Renders a raw markdown string as React elements. Strips the leading H1 and
 * "Last updated" line since LegalPageLayout already renders those from props.
 *
 * @param {{ content: string }} props
 */
export default function LegalMarkdownRenderer({ content }) {
  const body = safeStripFrontmatter(content);

  return (
    <LegalMarkdownErrorBoundary fallbackMarkdown={body}>
      <Markdown
        skipHtml
        components={{
          a: ({ href, children }) => {
            const safeHref = typeof href === 'string' && href.trim() ? href.trim() : '#';
            return (
              <a href={safeHref} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </Markdown>
    </LegalMarkdownErrorBoundary>
  );
}

class LegalMarkdownErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-200">
            This document could not be formatted for display. Raw text:
          </p>
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap wrap-break-word text-xs text-slate-300">
            {this.props.fallbackMarkdown}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function safeStripFrontmatter(md) {
  if (typeof md !== 'string') return '';
  try {
    return stripFrontmatter(md);
  } catch {
    return md;
  }
}

/**
 * Remove the leading `# Title` line and the `**Last updated:** ...` line
 * so the layout's own header + date aren't duplicated.
 */
function stripFrontmatter(md) {
  const lines = md.split('\n');
  let start = 0;
  const maxScan = Math.min(lines.length, 25);
  for (let i = 0; i < maxScan; i++) {
    const line = lines[i].trim();
    if (line === '') {
      start = i + 1;
      continue;
    }
    if (line.startsWith('# ')) {
      start = i + 1;
      continue;
    }
    if (line.startsWith('**Last updated')) {
      start = i + 1;
      continue;
    }
    break;
  }
  return lines.slice(start).join('\n');
}
