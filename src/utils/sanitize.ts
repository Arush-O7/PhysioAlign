// AI responses get rendered with dangerouslySetInnerHTML, so anything that
// isn't plain formatting gets stripped before it reaches the DOM.
const ALLOWED_TAGS = new Set([
  'H3', 'H4', 'P', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'BR', 'DIV', 'SPAN',
]);

export const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const clean = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(doc.createTextNode(child.textContent || ''));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        if (attr.name !== 'style') child.removeAttribute(attr.name);
      }
      clean(child);
    }
  };

  clean(doc.body);
  return doc.body.innerHTML;
}
