// Valida words.js: >=150 palavras por categoria, sem duplicatas (ignora acento/caixa), tamanho razoável.
const W = require('../public/intruso/words.js');
const cats = W.CATEGORIES || W.categories || W;
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let bad = 0;
for (const [name, list] of Object.entries(cats)) {
  const seen = new Map();
  for (const w of list) {
    const k = norm(w);
    if (seen.has(k)) { console.log(`DUP em ${name}: "${w}" = "${seen.get(k)}"`); bad++; }
    seen.set(k, w);
    if (w.length < 2 || w.length > 28 || /[?!]/.test(w)) { console.log(`SUSPEITA em ${name}: "${w}"`); bad++; }
  }
  if (list.length < 150) { console.log(`POUCAS em ${name}: ${list.length}`); bad++; }
  console.log(name.padEnd(20), list.length);
}
// duplicatas entre categorias
const all = new Map();
for (const [name, list] of Object.entries(cats)) for (const w of list) {
  const k = norm(w); if (all.has(k) && all.get(k) !== name) { console.log(`aviso: "${w}" em ${all.get(k)} e ${name}`); } all.set(k, name);
}
// pares do modo palavra parecida: toda categoria tem os seus, cada par com duas palavras diferentes
const PAIRS = require('../public/intruso/pairs.js');
for (const name of Object.keys(cats)) {
  const ps = PAIRS[name] || [];
  if (ps.length < 15) { console.log(`POUCOS PARES em ${name}: ${ps.length}`); bad++; }
  const seen = new Set();
  for (const pr of ps) {
    const [a, b, extra] = pr.split('|');
    if (!a || !b || extra !== undefined || norm(a) === norm(b) || a.length > 28 || b.length > 28) { console.log(`PAR RUIM em ${name}: "${pr}"`); bad++; }
    if (seen.has(norm(pr))) { console.log(`PAR DUPLICADO em ${name}: "${pr}"`); bad++; }
    seen.add(norm(pr));
  }
}
for (const name of Object.keys(PAIRS)) if (!cats[name]) { console.log(`PARES sem categoria: ${name}`); bad++; }
console.log(bad ? `FALHOU (${bad})` : 'OK');
process.exit(bad ? 1 : 0);
