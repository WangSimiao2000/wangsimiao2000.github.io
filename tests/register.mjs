// 让 Node 直接跑 src/assets/js 下的 .ts：源码里按浏览器习惯写 './x.js'，这里在找不到 .js 时改找同名 .ts。
// Node 24 自带类型擦除，不需要 TypeScript 或任何打包工具。用法：node --import ./tests/register.mjs --test
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try {
    return await next(spec, ctx);
  } catch (err) {
    if (spec.endsWith('.js') && ctx.parentURL?.endsWith('.ts')) return next(spec.slice(0, -3) + '.ts', ctx);
    throw err;
  }
}`),
  import.meta.url,
);
