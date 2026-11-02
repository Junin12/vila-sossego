// ---------- utilidades ----------
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: tudo bem */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
};

// Monta elementos só com textContent/atributos: nada de innerHTML com dado de jogador.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

// SVGs vêm de constantes deste arquivo; só o índice do personagem (validado) vem do servidor.
function av(i, size) {
  const a = AVATARS[i] || AVATARS[0];
  const d = h('div', { class: size ? 'av' : 'av fill', style: size ? `--s:${size}px;background:${a.bg}` : `background:${a.bg}`,
    role: 'img', 'aria-label': a.name, 'data-static': 'av' + i });
  d.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${a.art}</svg>`;
  return d;
}

function icon(name) {
  const s = h('span', { class: 'ic', 'data-static': name });
  s.innerHTML = ICONS[name];
  return s;
}

// Atualiza o DOM existente em vez de recriá-lo: campos de texto, foco e animações em curso são preservados.
function syncAttrs(o, n) {
  for (const { name, value } of Array.from(n.attributes)) if (o.getAttribute(name) !== value) o.setAttribute(name, value);
  for (const { name } of Array.from(o.attributes)) if (!n.hasAttribute(name)) o.removeAttribute(name);
}

function morph(oldParent, newParent) {
  const olds = Array.from(oldParent.childNodes);
  const news = Array.from(newParent.childNodes);
  for (let i = 0; i < Math.max(olds.length, news.length); i++) {
    const o = olds[i], n = news[i];
    if (!n) { oldParent.removeChild(o); continue; }
    if (!o) { oldParent.appendChild(n); continue; }
    const keyO = o.nodeType === 1 ? o.getAttribute('data-key') : null;
    const keyN = n.nodeType === 1 ? n.getAttribute('data-key') : null;
    if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName || keyO !== keyN) { oldParent.replaceChild(n, o); continue; }
    if (o.nodeType === 3) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; continue; }
    const st = o.getAttribute('data-static');
    const same = st !== null && st === n.getAttribute('data-static');   // lido antes de sincronizar atributos
    syncAttrs(o, n);
    if (same) continue;   // SVG idêntico: não mexe
    morph(o, n);
  }
}
