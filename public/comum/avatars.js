// ---------- personagens ----------
// 12 personagens desenhados em SVG (os 12 primeiros são livres; os 8 últimos são desbloqueados jogando. Total precisa bater com AVATAR_TOTAL em server.js).
const INK = '#17143F';
const ln = `stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"`;
const th = `fill="none" ${ln}`;
const sk = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const dot = (x, y, r = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/>`;
const AVATARS = [
  { name: 'Gato', bg: '#BFE3FF', art:
    `<path d="M15 28L17 9l13 9z" fill="#FF9F43" ${sk}/><path d="M49 28L47 9 34 18z" fill="#FF9F43" ${sk}/>` +
    `<ellipse cx="32" cy="36" rx="19" ry="17" fill="#FF9F43" ${sk}/>${dot(25, 34)}${dot(39, 34)}` +
    `<path d="M29.5 40h5L32 43z" fill="#FF6B8B"/><path d="M32 43q-3 4-6 1M32 43q3 4 6 1M11 38h8M12 44l7-2M53 38h-8M52 44l-7-2" ${th}/>` },
  { name: 'Cachorro', bg: '#FFD9E0', art:
    `<ellipse cx="14" cy="32" rx="6" ry="12" fill="#8A5A3C" ${sk} transform="rotate(14 14 32)"/>` +
    `<ellipse cx="50" cy="32" rx="6" ry="12" fill="#8A5A3C" ${sk} transform="rotate(-14 50 32)"/>` +
    `<ellipse cx="32" cy="35" rx="18" ry="18" fill="#F0CFA0" ${sk}/><ellipse cx="32" cy="42" rx="9.5" ry="7" fill="#FFF1D6"/>` +
    `${dot(25, 31)}${dot(39, 31)}<ellipse cx="32" cy="38" rx="3.6" ry="2.7" fill="${INK}"/>` +
    `<path d="M32 40.5v3M32 43.5q-3 3-6 0M32 43.5q3 3 6 0" ${th}/><path d="M30 45.5q2 5 4 0z" fill="#FF6B8B"/>` },
  { name: 'Urso', bg: '#CFF3E3', art:
    `<circle cx="17" cy="19" r="7" fill="#A36A43" ${sk}/><circle cx="47" cy="19" r="7" fill="#A36A43" ${sk}/>` +
    `<circle cx="32" cy="36" r="19" fill="#A36A43" ${sk}/><ellipse cx="32" cy="43" rx="9.5" ry="7" fill="#E9C39B"/>` +
    `${dot(25, 32)}${dot(39, 32)}<ellipse cx="32" cy="40" rx="3.6" ry="2.6" fill="${INK}"/>` +
    `<path d="M32 42.5v2M32 44.5q-2.5 2-5 0M32 44.5q2.5 2 5 0" ${th}/>` },
  { name: 'Sapo', bg: '#FFE9A8', art:
    `<ellipse cx="32" cy="41" rx="22" ry="16" fill="#5BD08A" ${sk}/><circle cx="21" cy="25" r="9" fill="#5BD08A" ${sk}/><circle cx="43" cy="25" r="9" fill="#5BD08A" ${sk}/>` +
    `<circle cx="21" cy="25" r="5.5" fill="#fff"/><circle cx="43" cy="25" r="5.5" fill="#fff"/>${dot(22, 26, 2.8)}${dot(42, 26, 2.8)}` +
    `<path d="M19 43q13 11 26 0" ${th}/><circle cx="15" cy="41" r="3" fill="#FF8FA3" opacity=".8"/><circle cx="49" cy="41" r="3" fill="#FF8FA3" opacity=".8"/>` },
  { name: 'Coruja', bg: '#FFD0B8', art:
    `<path d="M13 22L17 8l12 9z" fill="#8E7CF0" ${sk}/><path d="M51 22L47 8 35 17z" fill="#8E7CF0" ${sk}/>` +
    `<ellipse cx="32" cy="36" rx="20" ry="19" fill="#8E7CF0" ${sk}/>` +
    `<circle cx="23" cy="32" r="8.5" fill="#fff" ${sk}/><circle cx="41" cy="32" r="8.5" fill="#fff" ${sk}/>${dot(24, 33, 3.4)}${dot(40, 33, 3.4)}` +
    `<path d="M28.5 40h7L32 46z" fill="#FFC83D" ${ln}/>` },
  { name: 'Raposa', bg: '#D9E0FF', art:
    `<path d="M12 30L15 8l15 11z" fill="#FF7A45" ${sk}/><path d="M52 30L49 8 34 19z" fill="#FF7A45" ${sk}/>` +
    `<path d="M11 29Q32 12 53 29Q51 49 32 56Q13 49 11 29z" fill="#FF7A45" ${sk}/>` +
    `<path d="M12 31Q23 33 32 52Q16 47 12 31z" fill="#fff"/><path d="M52 31Q41 33 32 52Q48 47 52 31z" fill="#fff"/>` +
    `${dot(24, 34)}${dot(40, 34)}<ellipse cx="32" cy="50" rx="3.2" ry="2.4" fill="${INK}"/>` },
  { name: 'Panda', bg: '#FFD36E', art:
    `<circle cx="17" cy="19" r="7" fill="${INK}"/><circle cx="47" cy="19" r="7" fill="${INK}"/>` +
    `<circle cx="32" cy="36" r="19" fill="#fff" ${sk}/>` +
    `<ellipse cx="24" cy="33" rx="5" ry="6.6" fill="${INK}" transform="rotate(22 24 33)"/><ellipse cx="40" cy="33" rx="5" ry="6.6" fill="${INK}" transform="rotate(-22 40 33)"/>` +
    `<circle cx="24.5" cy="33" r="1.9" fill="#fff"/><circle cx="39.5" cy="33" r="1.9" fill="#fff"/>` +
    `<ellipse cx="32" cy="42" rx="3.3" ry="2.5" fill="${INK}"/><path d="M32 44.5q-3 3-6 0M32 44.5q3 3 6 0" ${th}/>` },
  { name: 'Coelho', bg: '#C9E8FF', art:
    `<ellipse cx="23" cy="15" rx="5.5" ry="12.5" fill="#FFD1E3" ${sk}/><ellipse cx="41" cy="15" rx="5.5" ry="12.5" fill="#FFD1E3" ${sk}/>` +
    `<ellipse cx="23" cy="16" rx="2" ry="8" fill="#FF8FB3"/><ellipse cx="41" cy="16" rx="2" ry="8" fill="#FF8FB3"/>` +
    `<ellipse cx="32" cy="40" rx="18.5" ry="16" fill="#FFD1E3" ${sk}/>${dot(25, 38)}${dot(39, 38)}` +
    `<ellipse cx="32" cy="43" rx="2.7" ry="2" fill="#FF6B8B"/><path d="M32 45q-3 3-6 0M32 45q3 3 6 0" ${th}/>` +
    `<rect x="29.6" y="46.5" width="4.8" height="5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1.5"/>` },
  { name: 'Pinguim', bg: '#FFE0C2', art:
    `<ellipse cx="32" cy="36" rx="19.5" ry="20" fill="#34417A" ${sk}/>` +
    `<path d="M19 36Q21 22 32 24Q43 22 45 36Q45 52 32 54Q19 52 19 36z" fill="#fff"/>` +
    `${dot(26, 35, 2.4)}${dot(38, 35, 2.4)}<path d="M28.5 41h7L32 46.5z" fill="#FF9F43" ${ln}/>` +
    `<circle cx="22.5" cy="42" r="2.6" fill="#FF8FA3" opacity=".8"/><circle cx="41.5" cy="42" r="2.6" fill="#FF8FA3" opacity=".8"/>` },
  { name: 'Robô', bg: '#FFD9E8', art:
    `<path d="M32 16V9" ${th}/><circle cx="32" cy="7.5" r="3.4" fill="#FF5A5F" ${ln}/>` +
    `<rect x="7" y="27" width="6" height="13" rx="2.5" fill="#7F96F0" ${sk}/><rect x="51" y="27" width="6" height="13" rx="2.5" fill="#7F96F0" ${sk}/>` +
    `<rect x="12" y="16" width="40" height="36" rx="11" fill="#A9BCFF" ${sk}/><rect x="17" y="24" width="30" height="14" rx="6" fill="${INK}"/>` +
    `<circle cx="25" cy="31" r="3.2" fill="#7CFFB2"/><circle cx="39" cy="31" r="3.2" fill="#7CFFB2"/><path d="M24 45h16M27 43v4M32 43v4M37 43v4" ${th}/>` },
  { name: 'Alien', bg: '#E3D6FF', art:
    `<path d="M24 14Q22 8 17 7M40 14Q42 8 47 7" ${th}/><circle cx="17" cy="7" r="2.6" fill="#7CFFB2" ${ln}/><circle cx="47" cy="7" r="2.6" fill="#7CFFB2" ${ln}/>` +
    `<path d="M32 13C52 13 56 35 46 47Q40 55 32 55Q24 55 18 47C8 35 12 13 32 13z" fill="#8BE35B" ${sk}/>` +
    `<ellipse cx="24" cy="34" rx="6" ry="8.2" fill="${INK}" transform="rotate(-18 24 34)"/><ellipse cx="40" cy="34" rx="6" ry="8.2" fill="${INK}" transform="rotate(18 40 34)"/>` +
    `<circle cx="22.5" cy="31" r="1.9" fill="#fff"/><circle cx="38.5" cy="31" r="1.9" fill="#fff"/><path d="M28 47q4 3 8 0" ${th}/>` },
  { name: 'Leão', bg: '#BFEFE0', art:
    `<circle cx="32" cy="34" r="26" fill="#D9822B" ${sk}/><circle cx="17" cy="16" r="5.5" fill="#FFC83D" ${sk}/><circle cx="47" cy="16" r="5.5" fill="#FFC83D" ${sk}/>` +
    `<circle cx="32" cy="37" r="17" fill="#FFC83D" ${sk}/>${dot(26, 34)}${dot(38, 34)}<ellipse cx="32" cy="43" rx="7.5" ry="5.5" fill="#FFF1D6"/>` +
    `<path d="M29.5 40h5L32 43z" fill="#C4552D"/><path d="M32 43v2M32 45q-2.5 2-5 0M32 45q2.5 2 5 0" ${th}/>` },
  // ----- exclusivos (desbloqueados jogando; as regras estão em profile.js) -----
  { name: 'Dragão', bg: '#C8F5D0', art:
    `<path d="M19 20L14 6l12 8z" fill="#FFD23F" ${sk}/><path d="M45 20L50 6 38 14z" fill="#FFD23F" ${sk}/>` +
    `<ellipse cx="32" cy="38" rx="20" ry="18" fill="#43C768" ${sk}/><path d="M27 21l5-7 5 7z" fill="#FF8A3D" ${ln}/>` +
    `<ellipse cx="32" cy="46" rx="11" ry="8" fill="#A5F0AE"/>${dot(28, 46, 1.7)}${dot(36, 46, 1.7)}` +
    `${dot(24, 33)}${dot(40, 33)}<path d="M19 27l8 3M45 27l-8 3" ${th}/>` },
  { name: 'Fantasma', bg: '#DDE6FF', art:
    `<path d="M13 55V31C13 17 21 9 32 9S51 17 51 31V55l-6.3-5-6.3 5-6.4-5-6.3 5-6.4-5z" fill="#fff" ${sk}/>` +
    `<ellipse cx="25" cy="30" rx="3.4" ry="5" fill="${INK}"/><ellipse cx="39" cy="30" rx="3.4" ry="5" fill="${INK}"/>` +
    `<ellipse cx="32" cy="42" rx="3.6" ry="4.6" fill="${INK}"/><circle cx="19" cy="38" r="3" fill="#FF8FA3" opacity=".7"/><circle cx="45" cy="38" r="3" fill="#FF8FA3" opacity=".7"/>` },
  { name: 'Ninja', bg: '#FFD9D0', art:
    `<circle cx="32" cy="36" r="20" fill="#2B2F66" ${sk}/><rect x="14" y="29" width="36" height="12" rx="6" fill="#FFD6A8" ${ln}/>` +
    `${dot(25, 35, 2.5)}${dot(39, 35, 2.5)}<path d="M21 30l7 3M43 30l-7 3" ${th}/>` +
    `<path d="M12 25q20-10 40 0v5q-20-10-40 0z" fill="#FF5A5F" ${ln}/><path d="M50 24l9-4-3 9z" fill="#FF5A5F" ${ln}/>` },
  { name: 'Astronauta', bg: '#B9CCFF', art:
    `<path d="M32 12V6" ${th}/><circle cx="32" cy="5" r="2.8" fill="#FF5A5F" ${ln}/>` +
    `<circle cx="32" cy="35" r="23" fill="#F4F6FF" ${sk}/><rect x="14" y="24" width="36" height="23" rx="11.5" fill="#2B2F66" ${sk}/>` +
    `<path d="M21 32q3-5 9-5" stroke="#9FB4FF" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M27 41q5 3.5 10 0" stroke="#9FB4FF" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  { name: 'Pirata', bg: '#FFE9A8', art:
    `<circle cx="32" cy="38" r="18" fill="#FFD6A8" ${sk}/><path d="M13 32Q32 6 51 32Q32 21 13 32z" fill="#FF5A5F" ${sk}/>` +
    `<circle cx="24" cy="23" r="1.6" fill="#fff"/><circle cx="32" cy="19" r="1.6" fill="#fff"/><circle cx="40" cy="23" r="1.6" fill="#fff"/>` +
    `<path d="M16 33l24 8" ${th}/><ellipse cx="25" cy="38" rx="5.6" ry="4.6" fill="${INK}"/>${dot(39, 36)}` +
    `<path d="M25 48q7 5 14 0" ${th}/><circle cx="14.5" cy="44" r="2.8" fill="none" stroke="#FFC83D" stroke-width="2"/>` },
  { name: 'Mago', bg: '#E3D6FF', art:
    `<circle cx="32" cy="41" r="13" fill="#FFD6A8" ${sk}/><path d="M32 2L16 29h32z" fill="#6A4CE0" ${sk}/><ellipse cx="32" cy="29" rx="20" ry="5" fill="#6A4CE0" ${sk}/>` +
    `<path d="M32 11l1.9 4.2 4.5.4-3.4 3 1 4.4-4-2.4-4 2.4 1-4.4-3.4-3 4.5-.4z" fill="#FFD23F"/>` +
    `${dot(27, 38, 2.2)}${dot(37, 38, 2.2)}<path d="M19 44q13 20 26 0q-6 5-13 5t-13-5z" fill="#fff" ${sk}/>` },
  { name: 'Unicórnio', bg: '#FFE0F2', art:
    `<ellipse cx="14" cy="38" rx="6.5" ry="15" fill="#FF8FD0" ${sk}/><ellipse cx="50" cy="38" rx="6.5" ry="15" fill="#7CC6FF" ${sk}/>` +
    `<path d="M32 2l-5.5 18h11z" fill="#FFD23F" ${sk}/><path d="M20 24l-4-9 9 4z" fill="#fff" ${sk}/><path d="M44 24l4-9-9 4z" fill="#fff" ${sk}/>` +
    `<ellipse cx="32" cy="39" rx="17" ry="17" fill="#fff" ${sk}/><path d="M16 33Q24 22 32 29Q40 22 48 33Q40 27 32 34Q24 27 16 33z" fill="#B58CFF" ${sk}/>` +
    `<path d="M22 40q3-3.2 6 0M36 40q3-3.2 6 0" ${th}/><circle cx="21" cy="46" r="3" fill="#FF8FA3" opacity=".7"/><circle cx="43" cy="46" r="3" fill="#FF8FA3" opacity=".7"/><path d="M28 48q4 3 8 0" ${th}/>` },
  { name: 'Rei', bg: '#FFD36E', art:
    `<circle cx="32" cy="41" r="17" fill="#FFD6A8" ${sk}/><path d="M14 28l4-15 8 8 6-12 6 12 8-8 4 15z" fill="#FFC83D" ${sk}/>` +
    `<circle cx="32" cy="17" r="2.4" fill="#FF5A5F" ${ln}/><circle cx="20" cy="22" r="1.9" fill="#1FC98D" ${ln}/><circle cx="44" cy="22" r="1.9" fill="#1FC98D" ${ln}/>` +
    `${dot(26, 40)}${dot(38, 40)}<path d="M22 47q5-4 10 0q5-4 10 0q-4 5-10 1-6 4-10-1z" fill="#8A5A3C" ${ln}/>` },
];

const AVATAR_BASE = 12;   // livres para todos
const MARK = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="35" r="26" fill="#FFD23F" ${sk}/>` +
  `<path d="M17 27c0-11 6-17 15-17s15 6 15 17z" fill="${INK}"/><path d="M10 28h44" ${sk}/>` +
  `<circle cx="24" cy="39" r="5.5" fill="#fff" ${sk}/><circle cx="40" cy="39" r="5.5" fill="#fff" ${sk}/>${dot(26.5, 39, 2.3)}${dot(42.5, 39, 2.3)}` +
  `<path d="M26 50q6 4 12 0" fill="none" ${sk}/></svg>`;

const ICONS = {
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#FFD23F" stroke="#17143F" stroke-width="2" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>',
  exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8.5a5 5 0 010 7M19.5 6a8.5 8.5 0 010 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
};

// SVG completo do personagem (para desenhar no cartão de compartilhar).
function avatarSvg(i) {
  const a = AVATARS[i] || AVATARS[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${a.bg}"/>${a.art}</svg>`;
}
