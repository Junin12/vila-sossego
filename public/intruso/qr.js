'use strict';
// Gerador de QR Code mínimo (modo byte, correção M, versões 1 a 6 = até 106 bytes). Sem dependências.
const QR = (() => {
  // [palavras de dados por bloco, nº de blocos, palavras de correção por bloco] por versão (nível M)
  const SPEC = [null, [16, 1, 10], [28, 1, 16], [44, 1, 26], [32, 2, 18], [43, 2, 24], [27, 4, 16]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

  const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
  function rsDivisor(deg) {
    const r = new Array(deg - 1).fill(0).concat([1]); let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = gmul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); }
    return r;
  }

  function codewords(bytes, ver) {
    const [dpb, nb, epb] = SPEC[ver], cap = dpb * nb;
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(bytes.length, 8); bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
    const div = rsDivisor(epb), blocks = [], ecs = [];
    for (let b = 0; b < nb; b++) { const d = data.slice(b * dpb, (b + 1) * dpb); blocks.push(d); ecs.push(rsRemainder(d, div)); }
    const out = [];
    for (let i = 0; i < dpb; i++) blocks.forEach((b) => out.push(b[i]));
    for (let i = 0; i < epb; i++) ecs.forEach((e) => out.push(e[i]));
    return out;
  }

  function build(bytes, ver, mask) {
    const size = ver * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = v; fn[y][x] = true; } };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
    }
    const ap = ALIGN[ver], last = ap.length - 1;
    ap.forEach((ax, i) => ap.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    // formato (nível M = 00)
    const d = mask; let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((d << 10) | rem) ^ 0x5412, bit = (i) => ((fb >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
    // dados em zigue-zague
    const cw = codewords(bytes, ver); let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!fn[y][x] && k < cw.length * 8) { m[y][x] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
      }
    }
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
    return m;
  }

  function penalty(m) {
    const n = m.length; let p = 0;
    const runs = (get) => {
      for (let a = 0; a < n; a++) {
        let run = 1;
        for (let b = 1; b < n; b++) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      }
    };
    runs((a, b) => m[a][b]); runs((a, b) => m[b][a]);
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], rev = pat.slice().reverse();
    const hit = (line, q) => q.every((v, i) => (line[i] ? 1 : 0) === v);
    for (let a = 0; a < n; a++) for (let b = 0; b + 11 <= n; b++) {
      const row = m[a].slice(b, b + 11), col = m.slice(b, b + 11).map((r) => r[a]);
      if (hit(row, pat) || hit(row, rev)) p += 40;
      if (hit(col, pat) || hit(col, rev)) p += 40;
    }
    const dark = m.flat().filter(Boolean).length;
    return p + Math.floor(Math.abs((dark * 20) - n * n * 10) / (n * n)) * 10;
  }

  function make(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 1;
    while (ver <= 6 && bytes.length > SPEC[ver][0] * SPEC[ver][1] - 2) ver++;
    if (ver > 6) throw new Error('Texto longo demais para o QR.');
    let best = null, bp = Infinity;
    for (let mask = 0; mask < 8; mask++) { const m = build(bytes, ver, mask); const p = penalty(m); if (p < bp) { bp = p; best = m; } }
    return best;
  }

  // SVG com margem de 4 módulos; só números e constantes (seguro para innerHTML).
  function svg(text) {
    const m = make(text), n = m.length + 8; let d = '';
    m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code da sala"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#17143F"/></svg>`;
  }
  return { make, svg };
})();
if (typeof module !== 'undefined') module.exports = QR;
