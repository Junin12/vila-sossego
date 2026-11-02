'use strict';
// Cartão de resumo da partida (imagem PNG) e link de WhatsApp.
const Share = (() => {
  function loadAvatar(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSvg(i));
    });
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // rows: [{name, avatar, score}] já ordenados; awards: [{label, name}]
  async function card({ rows, awards, rounds, link }) {
    const W = 1080, H = 1350, INKC = '#17143F', c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#3B49F0'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.16)';
    for (let y = 18; y < H; y += 36) for (let x = 18; x < W; x += 36) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
    const font = (w, s) => `${w} ${s}px "Bricolage Grotesque","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif`;
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = '#fff'; g.font = font(800, 110); g.fillText('INTRUSO', W / 2, 120);
    g.font = font(700, 38); g.fillText(`Fim de partida · ${rounds} rodadas`, W / 2, 205);
    const top = rows.slice(0, 5), imgs = await Promise.all(top.map((r) => loadAvatar(r.avatar)));
    let y = 270;
    top.forEach((r, i) => {
      const first = i === 0, h = first ? 170 : 120;
      g.fillStyle = first ? '#FFD23F' : '#fff'; g.strokeStyle = INKC; g.lineWidth = 8;
      rr(g, 80, y, W - 160, h, 36); g.fill(); g.stroke();
      const s = first ? 130 : 88, ax = 112, ay = y + (h - s) / 2;
      g.save(); g.beginPath(); g.arc(ax + s / 2, ay + s / 2, s / 2, 0, 7); g.clip();
      if (imgs[i]) g.drawImage(imgs[i], ax, ay, s, s); g.restore();
      g.lineWidth = 7; g.beginPath(); g.arc(ax + s / 2, ay + s / 2, s / 2, 0, 7); g.stroke();
      g.fillStyle = INKC; g.textAlign = 'left'; g.font = font(800, first ? 64 : 48);
      g.fillText(`${first ? '👑 ' : (i + 1) + 'º '}${r.name}`.slice(0, 18), ax + s + 30, y + h / 2);
      g.textAlign = 'right'; g.font = font(800, first ? 78 : 56); g.fillText(`${r.score}`, W - 120, y + h / 2);
      y += h + 22;
    });
    g.textAlign = 'center';
    if (awards.length) {
      y += 18; g.fillStyle = '#fff'; g.font = font(800, 44); g.fillText('Prêmios da noite', W / 2, y); y += 56;
      for (const a of awards.slice(0, 4)) { g.fillStyle = 'rgba(255,255,255,.95)'; g.font = font(700, 38); g.fillText(`${a.label}: ${a.name}`.slice(0, 40), W / 2, y); y += 56; }
    }
    g.fillStyle = '#FFD23F'; g.font = font(800, 40); g.fillText('Quem é o intruso na sua mesa?', W / 2, H - 120);
    g.fillStyle = '#fff'; g.font = font(700, 32); g.fillText(link.replace(/^https?:\/\//, '').replace(/\?.*$/, ''), W / 2, H - 66);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  function whatsappUrl(text) { return 'https://wa.me/?text=' + encodeURIComponent(text); }
  return { card, whatsappUrl };
})();
