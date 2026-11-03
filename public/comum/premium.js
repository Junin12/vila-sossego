'use strict';
// Premium da Vila (só funciona dentro do app Android, que expõe window.AndroidApp; no navegador vira convite para o app).
// - Passe da Noite (passe_noite, consumível): 24h de tudo liberado para a sala de quem comprou.
// - Vila Completa (vila_completa, compra única): tudo para sempre, sem anúncios.
// - Presente para a sala: um convidado vê um anúncio premiado e libera a sala por 3 horas.
// - Anúncio só para quem cria a sala, entre partidas (no máximo 1 a cada 3 min, a cada 2 partidas).
// - Pedido de avaliação na loja depois da 3ª vitória (uma vez só).
const Premium = (() => {
  const native = window.AndroidApp || null;
  const KEY = 'vila-premium';
  const IDS = ['vila_completa', 'passe_noite', 'remove_ads'];
  const PASSE_MS = 24 * 60 * 60 * 1000;
  const GAP_MS = 3 * 60 * 1000, EVERY = 2, REWARD_PER_DAY = 5;
  // pacote do app na loja (para avaliar): Intruso tem o app próprio; Ninguém Dorme e Cara de Pau vêm no app da Vila
  const LOJA = location.pathname.includes('/intruso') ? 'br.com.intruso.jogo' : 'br.com.vilasossego.ninguemdorme';
  let s = Object.assign({ owned: [], prices: {}, passeAte: 0, partidas: 0, lastAd: 0, rewardDay: '', rewardCount: 0, vitorias: 0, avaliou: false },
    (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ok */ } };
  const call = (fn, ...a) => { try { if (native && typeof native[fn] === 'function') native[fn](...a); } catch { /* ponte indisponível */ } };
  const hoje = () => new Date().toISOString().slice(0, 10);
  let ouvintes = [], recompensa = null, falhou = null;
  const avisa = () => ouvintes.forEach((f) => { try { f(); } catch { /* ok */ } });

  // eventos do app nativo (mesmo formato do Intruso)
  window.onMonet = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.type === 'owned' && Array.isArray(e.ids)) { s.owned = e.ids.filter((x) => IDS.includes(x) && x !== 'passe_noite'); save(); }
    else if (e.type === 'prices' && e.prices) { s.prices = {}; for (const id of IDS) if (typeof e.prices[id] === 'string') s.prices[id] = e.prices[id].slice(0, 20); save(); }
    else if (e.type === 'purchased') {
      if (e.id === 'passe_noite') s.passeAte = Math.max(s.passeAte, Date.now()) + PASSE_MS;
      else if (IDS.includes(e.id) && !s.owned.includes(e.id)) s.owned.push(e.id);
      save();
    } else if (e.type === 'reward') {
      const cb = recompensa;
      if (e.ok && cb) { s.rewardCount++; save(); cb(); } else if (!e.ok && falhou) falhou();
      recompensa = null; falhou = null;
    }
    avisa();
  };
  if (native) call('init');

  const completa = () => s.owned.includes('vila_completa');
  return {
    app: !!native,
    preco: (id) => s.prices[id] || '',
    completa,
    ativo: () => completa() || s.passeAte > Date.now(),
    // até quando a sala do anfitrião fica liberada (Vila Completa renova sozinha a cada partida)
    ate: () => (completa() ? Date.now() + 47 * 3600000 : s.passeAte),
    semAnuncio: () => completa() || s.passeAte > Date.now() || s.owned.includes('remove_ads'),
    comprar: (id) => { if (IDS.includes(id)) call('buy', id); },
    podePresentear() {
      if (!native) return false;
      if (s.rewardDay !== hoje()) { s.rewardDay = hoje(); s.rewardCount = 0; save(); }
      return s.rewardCount < REWARD_PER_DAY;
    },
    presentear(ok, erro) { if (!this.podePresentear()) return; recompensa = ok; falhou = erro || null; call('showRewarded'); },
    // fim de partida: anúncio só para o anfitrião; conta vitórias para o pedido de avaliação
    depoisDaPartida({ anfitriao = false, venceu = false } = {}) {
      if (venceu) { s.vitorias++; save(); }
      if (!native || !anfitriao || this.semAnuncio()) return;
      s.partidas++;
      const vez = s.partidas % EVERY === 0 && Date.now() - s.lastAd > GAP_MS;
      if (vez) s.lastAd = Date.now();
      save();
      if (vez) call('showInterstitial');
    },
    querAvaliar: () => !!native && !s.avaliou && s.vitorias >= 3,
    avaliar() { s.avaliou = true; save(); call('openUrl', `market://details?id=${LOJA}`); },
    dispensarAvaliacao() { s.avaliou = true; save(); },
    lojaUrl: `https://play.google.com/store/apps/details?id=${LOJA}`,
    onChange: (f) => { ouvintes.push(f); },
  };
})();
window.Premium = Premium;   // as telas testam window.Premium (const no topo não vira propriedade de window)
