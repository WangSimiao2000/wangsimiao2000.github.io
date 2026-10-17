import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, plainText, excerpt } from '../../build/markdown.mjs';
import { html, raw, escape } from '../../build/html.mjs';
import { slugify, tagUrl, readingMinutes } from '../../src/templates/util.mjs';

test('html`` 插值自动转义，raw() 和嵌套片段原样输出', () => {
  const evil = '<script>alert("x")</script>';
  assert.equal(String(html`<p>${evil}</p>`), '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>');
  assert.equal(String(html`<p>${raw('<b>ok</b>')}</p>`), '<p><b>ok</b></p>');
  assert.equal(String(html`<ul>${['a', 'b'].map((x) => html`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(String(html`${null}${undefined}${false}`), '');
  assert.equal(escape(`'&`), '&#39;&amp;');
});

test('slugify 与旧站 Jekyll 一致，标签地址不变', () => {
  assert.equal(slugify('Minecraft'), 'minecraft');
  assert.equal(slugify('C语言'), 'c语言');
  assert.equal(slugify(' Unity / C# '), 'unity-c');
  assert.equal(tagUrl('图形学'), '/browse/tags/' + encodeURIComponent('图形学') + '/');
});

test('公式只在 math: true 时渲染，旧站 MathJax 写法兼容', () => {
  const src = '面积 $ \\pi r^2 $，还有 $$E=mc^2$$';
  assert.doesNotMatch(renderMarkdown(src).html, /katex/);
  const out = renderMarkdown(src, { math: true }).html;
  assert.equal((out.match(/class="katex"/g) ?? []).length, 2);
  assert.doesNotMatch(out, /katex-error/);
});

test('kramdown 图片宽度、标题 id 与目录', () => {
  const { html: out, toc } = renderMarkdown('## 第一节\n\n![图](a.png){:width="700px"}\n\n### 小节\n');
  assert.match(out, /<img[^>]*width="700"[^>]*loading="lazy"/);
  assert.doesNotMatch(out, /\{:/);
  assert.deepEqual(toc.map((t) => t.level), [2, 3]);
  assert.ok(toc.every((t) => out.includes(`id="${t.id}"`)));
});

test('代码块构建时高亮，页面不需要脚本', () => {
  const out = renderMarkdown('```js\nconst a = 1;\n```').html;
  assert.match(out, /hljs-keyword/);
});

test('plainText / excerpt 去掉代码、公式、链接标记', () => {
  const src = '# 标题\n\n看[这里](https://x)和 `代码`\n\n```\nsecret()\n```\n\n$$x$$';
  const txt = plainText(src);
  assert.doesNotMatch(txt, /secret|https|#|`/);
  assert.match(txt, /看这里和 代码/);
  assert.ok(excerpt('字'.repeat(200), 10).endsWith('…'));
});

test('阅读时长至少 1 分钟，代码按 1/3 计', () => {
  assert.equal(readingMinutes('短'), 1);
  assert.equal(readingMinutes('字'.repeat(4000)), 10);
  assert.ok(readingMinutes('```\n' + 'x'.repeat(4000) + '\n```') < 10);
});
