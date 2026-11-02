'use strict';
// Contas (Firebase Auth) e dados na nuvem (Firestore): perfil sincronizado e ranking global.
// O SDK é carregado só se FIREBASE_CONFIG estiver preenchido. Sem isso, tudo segue local.
const Cloud = (() => {
  const V = '10.12.2', BASE = `https://www.gstatic.com/firebasejs/${V}/`;
  const cfg = window.FIREBASE_CONFIG;
  // O login do Google não funciona dentro de WebView (o Google bloqueia); no app Android a conta fica desligada.
  const enabled = !!(cfg && cfg.apiKey && cfg.projectId) && !window.AndroidApp;
  let fb = null, user = null, listeners = [], timer = null;

  async function sdk() {
    if (fb) return fb;
    const [app, auth, fs] = await Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')]);
    const a = app.initializeApp(cfg);
    fb = { auth, fs, authI: auth.getAuth(a), db: fs.getFirestore(a) };
    return fb;
  }

  const emit = () => listeners.forEach((f) => f(user));

  async function init() {
    if (!enabled) return;
    try {
      const s = await sdk();
      s.auth.onAuthStateChanged(s.authI, (u) => { user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '' } : null; emit(); });
    } catch { /* sem rede ou bloqueado: segue local */ }
  }

  async function signIn() {
    const s = await sdk();
    await s.auth.signInWithPopup(s.authI, new s.auth.GoogleAuthProvider());
  }
  async function signOut() { const s = await sdk(); await s.auth.signOut(s.authI); }

  // Perfil completo (privado) e resumo público (ranking). Regras em firestore.rules.
  async function pull() {
    if (!user) return null;
    const s = await sdk();
    const snap = await s.fs.getDoc(s.fs.doc(s.db, 'users', user.uid));
    return snap.exists() ? snap.data().p || null : null;
  }

  function publicView(prof, name, avatar) {
    const li = Profile.levelInfo(prof.xp);
    return { name: String(name || 'Jogador').slice(0, 14), avatar, xp: prof.xp, level: li.level, title: li.title,
      wins: prof.wins, impWins: prof.impWins, matchWins: prof.matchWins, rounds: prof.rounds };
  }

  async function push(prof, name, avatar) {
    if (!user) return;
    const s = await sdk();
    const now = s.fs.serverTimestamp();
    await Promise.all([
      s.fs.setDoc(s.fs.doc(s.db, 'users', user.uid), { p: JSON.parse(JSON.stringify(prof)), updated: now }),
      s.fs.setDoc(s.fs.doc(s.db, 'board', user.uid), { ...publicView(prof, name, avatar), updated: now }),
    ]);
  }

  // Agrupa gravações seguidas (uma por rodada já basta).
  function pushSoon(getArgs) {
    if (!user) return;
    clearTimeout(timer);
    timer = setTimeout(() => { const a = getArgs(); push(a.prof, a.name, a.avatar).catch(() => {}); }, 1500);
  }

  async function board(limit = 50) {
    const s = await sdk();
    const q = s.fs.query(s.fs.collection(s.db, 'board'), s.fs.orderBy('xp', 'desc'), s.fs.limit(limit));
    const snap = await s.fs.getDocs(q);
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }

  return { enabled, init, signIn, signOut, pull, push, pushSoon, board, user: () => user, onAuth: (f) => { listeners.push(f); } };
})();
