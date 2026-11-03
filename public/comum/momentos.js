'use strict';
// Melhores Momentos: um vídeo vertical curto (formato Stories/Status) feito no próprio celular, sem servidor.
// Cenas: abertura → título do jogo → destaques um a um → campeão com confete → convite. Grava o canvas com MediaRecorder.
// Uso: Momentos.gerar({ titulo, destaque, linhas, avatares (índices ou "f:…"), fotoBase, cor1, cor2 }) → File (mp4 ou webm)
const Momentos = (() => {
  const W = 720, H = 1280, FPS = 30;
  const tipo = () => ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  const pode = () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && tipo());

  function imagem(i, fotoBase) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img); img.onerror = () => resolve(null);
      if (typeof i === 'string' && i.startsWith('f:')) { const [, id, v] = i.split(':'); img.src = `${fotoBase}&id=${id}&v=${v}`; return; }
      const a = (window.AVATARS || [])[i] || (window.AVATARS || [])[0];
      if (!a) { resolve(null); return; }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${a.bg}"/>${a.art}</svg>`);
    });
  }
  function quebra(x, t, max) {
    const out = []; let l = '';
    for (const w of String(t).split(' ')) { const s = l ? l + ' ' + w : w; if (x.measureText(s).width > max && l) { out.push(l); l = w; } else l = s; }
    if (l) out.push(l);
    return out;
  }
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

  async function gerar(d) {
    if (!pode()) throw new Error('Este aparelho não grava vídeo. Use o Álbum (imagem).');
    const imgs = await Promise.all((d.avatares || []).slice(0, 3).map((i) => imagem(i, d.fotoBase || '')));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const cenas = [
      { dur: 1.4, desenha: (t) => { centro(x, '🏘️', 140, 520, t); texto(x, 'VILA SOSSEGO', 62, 700, '#FFD23F', t); texto(x, 'apresenta', 40, 770, '#fff', t); } },
      { dur: 1.6, desenha: (t) => { texto(x, 'Melhores momentos', 44, 480, '#FFD23F', t); texto(x, d.titulo, 84, 600, '#fff', t); } },
      ...(d.linhas || []).slice(0, 5).map((l) => ({ dur: 1.5, desenha: (t) => cartao(x, l, t) })),
      { dur: 2.6, desenha: (t, tt) => { avatares(x, imgs, t); texto(x, d.destaque, 64, 860, '#FFD23F', t); confete(x, tt); } },
      { dur: 1.6, desenha: (t) => { texto(x, 'Bora jogar?', 70, 560, '#fff', t); texto(x, 'wiapps.com.br/vila', 46, 660, '#FFD23F', t); } },
    ];
    const total = cenas.reduce((a, s) => a + s.dur, 0);
    // grava num formato; se o aparelho devolver vídeo vazio (alguns não gravam MP4), tenta WebM
    async function gravar(mime) {
      const stream = c.captureStream(0);   // quadro a quadro (requestFrame): grava mesmo com a tela em segundo plano
      const trilha = stream.getVideoTracks()[0];
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
      const partes = [];
      rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      const fim = new Promise((r) => { rec.onstop = r; });
      rec.start(250);
      const t0 = performance.now();
      await new Promise((resolve) => {
        function quadro() {
          const tt = (performance.now() - t0) / 1000;
          if (tt >= total) { resolve(); return; }
          let acc = 0, cena = cenas[0];
          for (const s of cenas) { if (tt < acc + s.dur) { cena = s; break; } acc += s.dur; }
          fundo(x, d);
          cena.desenha((tt - acc) / Math.min(0.5, cena.dur), tt);
          if (trilha.requestFrame) trilha.requestFrame();
          setTimeout(quadro, 1000 / FPS);   // não usa requestAnimationFrame: ele pausa com o app em segundo plano
        }
        quadro();
      });
      rec.stop();
      await fim;
      trilha.stop();
      return new Blob(partes, { type: mime.split(';')[0] });
    }
    let mime = tipo();
    let blob = await gravar(mime);
    if (!blob.size && mime.includes('mp4') && MediaRecorder.isTypeSupported('video/webm')) { mime = 'video/webm'; blob = await gravar(mime); }
    if (!blob.size) throw new Error('Não consegui gravar o vídeo neste aparelho. Use o Álbum (imagem).');
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    return new File([blob], `vila-melhores-momentos.${ext}`, { type: blob.type });
  }

  function fundo(x, d) {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, d.cor1 || '#3B49F0'); g.addColorStop(1, d.cor2 || '#17143F');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < W; i += 36) for (let j = 0; j < H; j += 36) { x.beginPath(); x.arc(i, j, 2.4, 0, 6.3); x.fill(); }
  }
  function texto(x, t, tam, y, cor, k) {
    const e = ease(k);
    x.save(); x.globalAlpha = e; x.translate(0, (1 - e) * 40);
    x.fillStyle = cor; x.textAlign = 'center'; x.font = `800 ${tam}px "Bricolage Grotesque", system-ui, sans-serif`;
    quebra(x, t, W - 100).forEach((l, i) => { x.strokeStyle = '#17143F'; x.lineWidth = 8; x.strokeText(l, W / 2, y + i * tam * 1.15); x.fillText(l, W / 2, y + i * tam * 1.15); });
    x.restore();
  }
  function centro(x, emoji, tam, y, k) {
    const e = ease(k);
    x.save(); x.globalAlpha = e; x.font = `${tam * (0.6 + 0.4 * e)}px sans-serif`; x.textAlign = 'center'; x.fillText(emoji, W / 2, y); x.restore();
  }
  function cartao(x, t, k) {
    const e = ease(k);
    x.save(); x.globalAlpha = e; x.translate((1 - e) * W * 0.3, 0);
    x.fillStyle = '#fff'; x.strokeStyle = '#17143F'; x.lineWidth = 8;
    const bx = 60, by = 470, bw = W - 120, bh = 340;
    x.beginPath(); x.roundRect ? x.roundRect(bx, by, bw, bh, 36) : x.rect(bx, by, bw, bh); x.fill(); x.stroke();
    x.fillStyle = '#17143F'; x.textAlign = 'center'; x.font = '800 46px "Bricolage Grotesque", system-ui, sans-serif';
    quebra(x, t, bw - 70).slice(0, 5).forEach((l, i, arr) => x.fillText(l, W / 2, by + bh / 2 - (arr.length - 1) * 28 + i * 56 + 14));
    x.restore();
  }
  function avatares(x, imgs, k) {
    const e = ease(k), n = Math.max(1, imgs.length), tam = n > 1 ? 210 : 300;
    imgs.forEach((img, i) => {
      const cx = W / 2 + (i - (n - 1) / 2) * (tam + 24), cy = 560;
      x.save(); x.translate(cx, cy); x.scale(e, e);
      x.beginPath(); x.arc(0, 0, tam / 2, 0, 6.3); x.fillStyle = '#fff'; x.fill(); x.save(); x.clip();
      if (img) x.drawImage(img, -tam / 2, -tam / 2, tam, tam);
      x.restore(); x.lineWidth = 12; x.strokeStyle = '#17143F'; x.beginPath(); x.arc(0, 0, tam / 2, 0, 6.3); x.stroke();
      x.restore();
    });
  }
  function confete(x, tt) {
    const cores = ['#FFD23F', '#FF5A5F', '#1FC98D', '#8E7CF0', '#fff'];
    for (let i = 0; i < 60; i++) {
      const y = ((tt * 260 + i * 97) % (H + 100)) - 50, xx = (i * 151) % W;
      x.save(); x.translate(xx, y); x.rotate(tt * 3 + i); x.fillStyle = cores[i % 5]; x.fillRect(-7, -11, 14, 22); x.restore();
    }
  }

  // gera e compartilha (ou baixa)
  async function compartilhar(d, avisar) {
    avisar('🎬 Montando o vídeo… (uns 10 segundos)');
    const file = await gerar(d);
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Melhores momentos da Vila' }); return; }
    } catch { return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.append(a); a.click(); a.remove();
    avisar('Vídeo salvo! 🎬', true);
  }

  return { pode, gerar, compartilhar };
})();
