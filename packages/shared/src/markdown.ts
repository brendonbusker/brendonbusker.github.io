const DANGEROUS_PROTOCOL = /(?:javascript|vbscript|data):/gi;
export function sanitizeMarkdown(markdown: string) {
  return markdown.replace(/<[^>]*>/g, '').replace(DANGEROUS_PROTOCOL, '').replace(/\]\((?!https?:\/\/|mailto:|\/|#)([^)]+)\)/gi, '](#)');
}
export function excerptFromMarkdown(markdown: string, max = 220) {
  const text = sanitizeMarkdown(markdown).replace(/```[\s\S]*?```/g, '').replace(/[#>*_`~\[\]()|-]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}
export function escapeYaml(value: string) { return JSON.stringify(value.replace(/\r\n/g, '\n')); }
