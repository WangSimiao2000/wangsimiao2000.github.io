/**
 * 极简 HTML 模板：html`...` 标签模板。
 * - 插值默认做 HTML 转义，防止文章标题、友链描述等数据破坏页面或注入脚本
 * - 已经是安全 HTML 的内容（渲染后的 Markdown、另一个 html`` 片段）用 raw() 包一层
 * - 数组会被逐项处理后拼接；null / undefined / false 输出为空
 */

const SAFE = Symbol('safe-html');

/** @typedef {{ [SAFE]: true, value: string, toString(): string }} SafeHtml */

/** @param {string} value @returns {SafeHtml} */
export function raw(value) {
  return { [SAFE]: true, value: String(value), toString() { return this.value; } };
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {unknown} s */
export function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[/** @type {keyof typeof ESC} */ (c)]);
}

/** @param {unknown} v @returns {string} */
function render(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(render).join('');
  if (typeof v === 'object' && /** @type {any} */ (v)[SAFE]) return /** @type {SafeHtml} */ (v).value;
  return escape(v);
}

/** @param {TemplateStringsArray} strings @param {...unknown} values @returns {SafeHtml} */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return raw(out);
}
