'use strict';
// Monetização (só ativa dentro do app Android, que expõe `window.AndroidApp`; no navegador não aparece nada).
// - Anúncio intersticial a cada 2 partidas (no máximo 1 a cada 3 min). "Remover anúncios" desliga.
// - Anúncio com recompensa: +30 XP (até 3 por dia).
// - Compras: remove_ads e avatar_pack (libera os 8 personagens exclusivos).
const Monet = (() => {
  const native = window.AndroidApp || null;
  const KEY = 'intruso-monet', IDS = ['remove_ads', 'avatar_pack'];
  const REWARD_XP = 30, REWARD_PER_DAY = 3, GAP_MS = 3 * 60 * 1000, EVERY = 2;
  let s = Object.assign({ owned: [], prices: {}, matches: 0, lastAd: 0, rewardDay: '', rewardCount: 0 }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })());
  let listeners = [], pendingReward = null, fail = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ok */ } };
  const today = () => new Date().toISOString().slice(0, 10);
  const emit = () => listeners.forEach((f) => f());
  const call = (fn, ...a) => { try { if (native && typeof native[fn] === 'function') native[fn](...a); } catch { /* ponte indisponível */ } };

  // Eventos vindos do app nativo.
  window.onMonet = (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.type === 'owned' && Array.isArray(e.ids)) { s.owned = e.ids.filter((x) => IDS.includes(x)); save(); emit(); }
    else if (e.type === 'prices' && e.prices && typeof e.prices === 'object') {
      s.prices = {}; for (const id of IDS) if (typeof e.prices[id] === 'string') s.prices[id] = e.prices[id].slice(0, 20);
      save(); emit();
    } else if (e.type === 'purchased' && IDS.includes(e.id)) { if (!s.owned.includes(e.id)) s.owned.push(e.id); save(); emit(); }
    else if (e.type === 'reward') {
      const cb = pendingReward;
      if (e.ok && cb) { s.rewardCount++; save(); cb(REWARD_XP); }
      else if (!e.ok && fail) fail();
      pendingReward = null; fail = null;
      emit();
    } else if (e.type === 'error') emit();
  };

  if (native) { call('init'); }

  return {
    available: !!native,
    REWARD_XP,
    owns: (id) => s.owned.includes(id),
    price: (id) => s.prices[id] || '',
    buy: (id) => { if (IDS.includes(id)) call('buy', id); },
    onChange: (f) => { listeners.push(f); },
    // Chamar ao terminar uma partida (já depois de enviar a ação ao servidor, para não atrasar a sala).
    afterMatch() {
      if (!native || s.owned.includes('remove_ads')) return;
      s.matches++;
      const due = s.matches % EVERY === 0 && Date.now() - s.lastAd > GAP_MS;
      save();
      if (due) { s.lastAd = Date.now(); save(); call('showInterstitial'); }
    },
    canReward() {
      if (!native) return false;
      if (s.rewardDay !== today()) { s.rewardDay = today(); s.rewardCount = 0; save(); }
      return s.rewardCount < REWARD_PER_DAY;
    },
    rewardsLeft() { this.canReward(); return Math.max(0, REWARD_PER_DAY - s.rewardCount); },
    rewarded(cb, onFail) { if (!this.canReward()) return; pendingReward = cb; fail = onFail || null; call('showRewarded'); },
    // Funções nativas (no app Android o navegador embutido não tem compartilhar/baixar/abrir links).
    openUrl: (url) => { if (native && native.openUrl) { call('openUrl', url); return true; } return false; },
    shareText: (text) => { if (native && native.share) { call('share', text); return true; } return false; },
    shareImage: (b64, text) => { if (native && native.shareImage) { call('shareImage', b64, text); return true; } return false; },
  };
})();
