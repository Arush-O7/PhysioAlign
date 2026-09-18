// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { escapeHtml, sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('keeps formatting tags', () => {
    expect(sanitizeHtml('<h4>Plan</h4><p><strong>Hold</strong> 30s</p><ul><li>a</li></ul>')).toBe(
      '<h4>Plan</h4><p><strong>Hold</strong> 30s</p><ul><li>a</li></ul>'
    );
  });

  it('strips scripts, event handlers and links', () => {
    const out = sanitizeHtml('<p onclick="steal()">hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:x">y</a>');
    expect(out).not.toMatch(/onclick|<script|<img|onerror|<a /);
    expect(out).toContain('<p>hi</p>');
  });
});

describe('escapeHtml', () => {
  it('escapes markup', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
  });
});
