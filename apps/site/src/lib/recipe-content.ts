import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/** Build inert search text from the published rich-text body. */
export async function recipeIndexContent(body: string) {
  const html = await marked.parse(body);
  // Keep word boundaries between blocks, but do not insert spaces around each
  // HTML entity (which would split a word such as Cr&egrave;me).
  const searchHtml = sanitizeHtml(html, {
    allowedTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'th', 'td', 'br', 'hr', 'blockquote', 'pre', 'div', 'section'],
    allowedAttributes: {},
  }).replace(/<[^>]*>/g, ' ');
  return { searchHtml };
}
