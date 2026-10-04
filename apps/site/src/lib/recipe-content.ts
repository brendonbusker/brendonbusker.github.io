import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/** Build inert search text and a safe cover from the published rich-text body. */
export async function recipeIndexContent(body: string) {
  const html = await marked.parse(body);
  // Keep word boundaries between blocks, but do not insert spaces around each
  // HTML entity (which would split a word such as Cr&egrave;me).
  const searchHtml = sanitizeHtml(html, {
    allowedTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'th', 'td', 'br', 'hr', 'blockquote', 'pre', 'div', 'section'],
    allowedAttributes: {},
  }).replace(/<[^>]*>/g, ' ');
  // Sanitize before extracting attributes; transformTags runs before sanitization.
  const images = sanitizeHtml(html, {
    allowedTags: ['img'], allowedAttributes: { img: ['src', 'alt'] },
    allowedSchemes: ['http', 'https'], allowProtocolRelative: false,
  });
  let cover: { src: string; alt: string } | undefined;
  sanitizeHtml(images, {
    transformTags: {
      img: (tagName, attribs) => {
        if (!cover && attribs.src) cover = { src: attribs.src, alt: attribs.alt || '' };
        return { tagName, attribs };
      },
    },
  });
  return { searchHtml, cover };
}
