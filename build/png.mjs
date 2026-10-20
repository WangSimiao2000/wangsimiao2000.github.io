/**
 * 最小的 PNG 读写（只用 Node 自带的 zlib），给像素图集打包用。
 *
 * 读：8 位的灰度 / 灰度+透明 / RGB / RGBA，以及 1/2/4/8 位索引色（带 tRNS 透明表）——
 * Aseprite、Piskel 导出的都在这几种里。隔行扫描、16 位深度不支持，遇到直接报出文件名。
 * 写：RGBA 8 位、不分滤波。
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * @param {Buffer} buf
 * @param {string} [name] 报错时带上的文件名
 * @returns {{ width: number, height: number, data: Uint8Array }} data 是 RGBA，每像素 4 字节
 */
export function decodePNG(buf, name = 'PNG') {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error(`${name}：不是 PNG 文件`);
  let off = 8;
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString('ascii', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (kind === 'PLTE') palette = body;
    else if (kind === 'tRNS') trns = body;
    else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
  }
  if (interlace) throw new Error(`${name}：不支持隔行扫描的 PNG，导出时关掉 interlace`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`${name}：不认识的颜色类型 ${type}`);
  if (depth !== 8 && !(type === 3 && [1, 2, 4].includes(depth))) throw new Error(`${name}：不支持 ${depth} 位深度（请导出 8 位）`);
  const bpp = Math.max(1, (channels * depth) >> 3); // 滤波按字节算的「每像素字节数」
  const stride = Math.ceil((width * channels * depth) / 8);
  const raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (f !== 0) throw new Error(`${name}：坏的滤波类型 ${f}`);
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (type === 3) {
        const perByte = 8 / depth;
        const idx = (row[Math.floor(x / perByte)] >> ((perByte - 1 - (x % perByte)) * depth)) & ((1 << depth) - 1);
        data[o] = palette[idx * 3];
        data[o + 1] = palette[idx * 3 + 1];
        data[o + 2] = palette[idx * 3 + 2];
        data[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
      } else {
        const s = x * channels;
        const gray = type === 0 || type === 4;
        data[o] = row[s];
        data[o + 1] = gray ? row[s] : row[s + 1];
        data[o + 2] = gray ? row[s] : row[s + 2];
        data[o + 3] = type === 6 ? row[s + 3] : type === 4 ? row[s + 1] : 255;
      }
    }
  }
  return { width, height, data };
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** RGBA -> PNG（8 位、不分滤波、最高压缩） */
export function encodePNG(width, height, data) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
