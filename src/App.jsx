import React, { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import { supabase } from "./supabaseClient";

/* ============================================================
   MAHJONG AUNTIE — interactive HK mahjong tutorial
   All 6 lessons playable · Hong Kong style
   New: back button, mnemonic cards, MTR diagram, floating junk
   ============================================================ */

const NUM_CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/* tile shorthand for lesson data */
const D = (n) => ({ s: "dots", n });
const B = (n) => ({ s: "bamboo", n });
const Ch = (n) => ({ s: "char", n });
const W = (c) => ({ s: "wind", c });
const Dr = (d) => ({ s: "dragon", d });
const Fl = (c, col) => ({ s: "flower", c, col });

/* ---- local memory (cookies/localStorage): remembers guests too ---- */
const LS_KEY = "sparrowschool.v1";
function lsLoad() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}
function lsSave(d) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) { /* private mode / sandbox */ }
}

/* ---------------- THEMES ---------------- */

const THEMES = {
  duo: {
    id: "duo", label: "Hong Kong Pop", desc: "Bright, friendly, a little neon — the default",
    pageBg: "linear-gradient(180deg,#FFF8EC 0%,#EAF6EF 100%)",
    surface: "#FFFDF6", ink: "#3A3A40", sub: "#8F8B82",
    primary: "#00A87E", primaryDeep: "#00875F", neonPink: "#FF4D8D",
    success: "#00A87E", successDeep: "#00875F", successSoft: "#DDF5EC",
    danger: "#E8453C", dangerSoft: "#FDE9E7", star: "#FFC233",
    card: "#FFFFFF", cardBorder: "#EDE5D4", cardShadow: "0 2.5px 0 #EDE5D4", chipShadow: "0 2px 0 #EDE5D4",
    locked: "#F1EEE6", lockedEdge: "#DEDAD0",
    radius: 19, btnEdge: true, upper: true, glass: false, sparkle: true, neon: true,
    fontDisplay: "'Baloo 2','Nunito',sans-serif", fontBody: "'Nunito',-apple-system,sans-serif",
    displaySpacing: "-.01em", bubbleRadius: "20px 20px 20px 6px", barTrack: "#F0EBDF",
  },
  apple: {
    id: "apple", label: "Minimal", desc: "Clean, calm & focused",
    pageBg: "linear-gradient(180deg,#FAFAFC 0%,#ECECF1 100%)",
    surface: "#F5F5F7", ink: "#1D1D1F", sub: "#6E6E73",
    primary: "#0A84FF", primaryDeep: "#0A84FF", neonPink: "#0A84FF",
    success: "#34C759", successDeep: "#2AA84A", successSoft: "#E4F8EA",
    danger: "#FF3B30", dangerSoft: "#FFE9E7", star: "#FF9F0A",
    card: "rgba(255,255,255,0.84)", cardBorder: "rgba(0,0,0,0.07)", cardShadow: "0 8px 24px rgba(0,0,0,.07)", chipShadow: "0 2px 10px rgba(0,0,0,.06)",
    locked: "#E9E9EC", lockedEdge: "transparent",
    radius: 20, btnEdge: false, upper: false, glass: true, sparkle: false, neon: false,
    fontDisplay: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
    fontBody: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif",
    displaySpacing: "-.02em", bubbleRadius: "20px", barTrack: "#E2E2E7",
  },
  kawaii: {
    id: "kawaii", label: "Kawaii", desc: "Soft, sweet & sparkly ✦",
    pageBg: "linear-gradient(160deg,#FFE3EC 0%,#E7F2FF 100%)",
    surface: "#FFFDF9", ink: "#4A4252", sub: "#9B91A3",
    primary: "#FF7FA3", primaryDeep: "#E0628C", neonPink: "#FF7FA3",
    success: "#2FA873", successDeep: "#23855B", successSoft: "#DCF3E8",
    danger: "#E15A54", dangerSoft: "#FCE8E6", star: "#F2BE45",
    card: "#FFFFFF", cardBorder: "#FFD3DF", cardShadow: "0 4px 0 #FFD3DF", chipShadow: "0 2.5px 0 #FFD3DF",
    locked: "#EFEBE4", lockedEdge: "#DDD7CC",
    radius: 22, btnEdge: true, upper: false, glass: false, sparkle: true, neon: true,
    fontDisplay: "'Baloo 2','Nunito',sans-serif", fontBody: "'Nunito',-apple-system,sans-serif",
    displaySpacing: "-.01em", bubbleRadius: "20px 20px 20px 5px", barTrack: "#FFEFF4",
  },
};

const TILE = { edge: "#E9E0D2", shadow: "#D9CDB8", face: "linear-gradient(180deg,#FFFFFF 0%,#FBF6EC 100%)" };
const SUIT = { blue: "#3B6BB5", green: "#2FA873", red: "#D6453F" };
const MTR_INK = "#2B2F36";

const ThemeCtx = createContext(THEMES.duo);
const useT = () => useContext(ThemeCtx);

/* ---------------- tile clack ---------------- */

let _actx = null;
function clack() {
  try {
    _actx = _actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = _actx.currentTime;
    const o = _actx.createOscillator();
    const g = _actx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.05);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g); g.connect(_actx.destination);
    o.start(t); o.stop(t + 0.08);
  } catch (e) { /* garnish, never a blocker */ }
}

/* ---------------- SOUND ENGINE (synth, mutable, persisted) ---------------- */
const SOUND = (() => {
  let muted = true; // default OFF until manually unmuted (awaiting hi-fi audio)
  try { const v = localStorage.getItem("ma.muted"); if (v !== null) muted = v === "1"; } catch (e) {}
  let ambient = null;
  const ac = () => { try { _actx = _actx || new (window.AudioContext || window.webkitAudioContext)(); return _actx; } catch (e) { return null; } };

  function tone({ freq = 600, dur = 0.06, type = "triangle", gain = 0.07, slideTo = null }) {
    if (muted) return;
    const c = ac(); if (!c) return;
    try {
      const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  // a tile click = a wooden knock: tonal body + a short filtered noise burst
  function tileClack(vol = 0.09) {
    if (muted) return;
    const f = 360 + Math.random() * 120;
    tone({ freq: f, slideTo: f * 0.5, dur: 0.045, gain: vol, type: "triangle" });
    // noise burst → "clack" texture
    const c = ac(); if (c) { try {
      const t = c.currentTime, dur = 0.05;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
      const src = c.createBufferSource(); src.buffer = buf;
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1600 + Math.random() * 800; bp.Q.value = 0.8;
      const ng = c.createGain(); ng.gain.value = vol * 0.9;
      src.connect(bp); bp.connect(ng); ng.connect(c.destination); src.start(t); src.stop(t + dur);
    } catch (e) {} }
    setTimeout(() => tone({ freq: f * 0.8, slideTo: f * 0.4, dur: 0.035, gain: vol * 0.6, type: "triangle" }), 16);
  }
  function discard() { tileClack(0.12); }
  function claim() { tone({ freq: 520, slideTo: 880, dur: 0.12, gain: 0.09, type: "square" }); setTimeout(() => tileClack(0.11), 60); }
  function win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone({ freq: f, dur: 0.16, gain: 0.08, type: "triangle" }), i * 90)); }
  function lose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone({ freq: f, dur: 0.18, gain: 0.06, type: "sine" }), i * 130)); }

  // OPTIONAL real ambience file: drop an mp3/ogg at /ambience.mp3 in the project's
  // public folder and it will loop softly instead of the synth flurries.
  let bgEl = null, fileChecked = false, fileOk = false;
  function tryFile() {
    if (fileChecked) return fileOk;
    fileChecked = true;
    try {
      const el = new Audio("/ambience.mp3");
      el.loop = true; el.volume = 0.18; el.preload = "auto";
      el.addEventListener("canplaythrough", () => { fileOk = true; bgEl = el; if (!muted) el.play().catch(() => {}); }, { once: true });
      el.addEventListener("error", () => { fileOk = false; });
    } catch (e) {}
    return fileOk;
  }

  // parlor ambience: real file if present, else sparse randomized synth clacks
  function startAmbience() {
    if (muted || ambient) return;
    tryFile();
    if (bgEl) { bgEl.play().catch(() => {}); return; }
    const c = ac(); if (!c) return;
    const tick = () => {
      if (bgEl) return; // file took over
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) setTimeout(() => tone({ freq: 280 + Math.random() * 180, slideTo: 150, dur: 0.05, gain: 0.022 + Math.random() * 0.02, type: "triangle" }), i * (40 + Math.random() * 60));
      ambient = setTimeout(tick, 700 + Math.random() * 1400);
    };
    ambient = setTimeout(tick, 400);
  }
  function stopAmbience() { if (ambient) { clearTimeout(ambient); ambient = null; } if (bgEl) { try { bgEl.pause(); } catch (e) {} } }
  function setMuted(m) { muted = m; try { localStorage.setItem("ma.muted", m ? "1" : "0"); } catch (e) {} if (m) stopAmbience(); }
  return { tileClack, discard, claim, win, lose, startAmbience, stopAmbience, setMuted, isMuted: () => muted };
})();


/* ---------------- TEACHER AVATARS ---------------- */

function AuntieAvatar({ size = 76, animate = true }) {
  // Mahjong Auntie — cute cartoon Asian auntie: gold glasses, permed hair,
  // jade twin-set, pearls + a luxe (IP-safe) quilted bag hanging from her arm.
  return (
    <svg viewBox="0 0 100 104" width={size} height={size * 1.04} className={animate ? "ss-bob" : ""} style={{ display: "block", overflow: "visible" }}>
      {/* ---- BODY (drawn first, behind head) ---- */}
      {/* left arm + hand resting, right arm bent holding the bag */}
      <path d="M30 86 q-9 -10 -4 -22" fill="none" stroke="#2FA877" strokeWidth="9" strokeLinecap="round" />
      <g className={animate ? "ss-armbag" : ""} style={{ transformOrigin: "70px 66px" }}>
        {/* right upper arm bent at elbow, forearm comes forward — the bag hangs in the crook */}
        <path d="M70 64 q10 4 11 15 q-1 9 -9 12" fill="none" stroke="#2FA877" strokeWidth="9" strokeLinecap="round" />
        {/* hand */}
        <circle cx="71" cy="91" r="5" fill="#F2C9A0" />
        {/* bag strap loops over the forearm, bag hangs below the elbow */}
        <g transform="translate(79 83)">
          <path d="M-9 -2 q0 -9 9 -9 q9 0 9 9" fill="none" stroke="#E7B53C" strokeWidth="1.8" />
          <rect x="-11" y="-2" width="22" height="17" rx="5" fill="#C0392B" stroke="#8E2A20" strokeWidth="1.5" />
          <path d="M-11 6 l22 0 M0 -2 l0 17 M-6 -2 l12 17 M6 -2 l-12 17" stroke="#A02E22" strokeWidth=".9" opacity=".65" />
          <rect x="-2" y="4" width="4.5" height="4" rx="1" fill="#FFD978" stroke="#D5A22B" strokeWidth=".6" />
        </g>
      </g>
      {/* shoulders / jade twin-set */}
      <path d="M24 100 q0 -26 26 -26 q26 0 26 26 Z" fill="#2FA877" />
      <path d="M24 100 q0 -26 26 -26 q26 0 26 26 Z" fill="none" stroke="#1F8C60" strokeWidth="1.5" />
      {/* pink scarf knot at collar */}
      <path d="M40 75 q10 9 20 0 l-4 9 q-6 4 -12 0 Z" fill="#FF7FA8" />
      {/* pearl necklace */}
      <path d="M41 77 q9 8 18 0" fill="none" stroke="#E7B53C" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="44" cy="79.5" r="1.5" fill="#FFF3D0" stroke="#D5A22B" strokeWidth=".5" />
      <circle cx="48" cy="81" r="1.5" fill="#FFF3D0" stroke="#D5A22B" strokeWidth=".5" />
      <circle cx="52" cy="81" r="1.5" fill="#FFF3D0" stroke="#D5A22B" strokeWidth=".5" />
      <circle cx="56" cy="79.5" r="1.5" fill="#FFF3D0" stroke="#D5A22B" strokeWidth=".5" />

      {/* ---- HEAD ---- */}
      {/* hair back (rounded permed bob) */}
      <path d="M26 42 q-3 -32 24 -34 q27 2 24 34 q2 12 -5 17 q1 -11 -3 -16 q-16 7 -32 0 q-4 5 -3 16 q-7 -5 -5 -17 Z" fill="#2E2A33" />
      {/* face */}
      <ellipse cx="50" cy="42" rx="21" ry="22" fill="#F4CDA4" />
      {/* ears + hoop earrings */}
      <circle cx="29.5" cy="46" r="3.2" fill="#F4CDA4" />
      <circle cx="70.5" cy="46" r="3.2" fill="#F4CDA4" />
      <circle cx="29" cy="50" r="3" fill="none" stroke="#E7B53C" strokeWidth="2" />
      <circle cx="71" cy="50" r="3" fill="none" stroke="#E7B53C" strokeWidth="2" />
      {/* soft permed fringe (rounded scallops, lighter) */}
      <path d="M32 29 q4 -7 10 -4 q4 -6 8 -2 q4 -4 8 -1 q5 -2 8 3 q-5 -1 -8 1 q-4 -4 -8 -1 q-4 -3 -8 0 q-5 -1 -10 4 Z" fill="#2E2A33" />
      <path d="M32 29 q3 5 8 5 M68 29 q-3 5 -8 5" fill="none" stroke="#2E2A33" strokeWidth="2.6" strokeLinecap="round" />
      {/* blush */}
      <ellipse cx="35" cy="48" rx="4.6" ry="3" fill="#FF9DBA" opacity=".7" />
      <ellipse cx="65" cy="48" rx="4.6" ry="3" fill="#FF9DBA" opacity=".7" />
      {/* eyes (with blink) */}
      <g className={animate ? "ss-blink" : ""} style={{ transformOrigin: "50px 42px" }}>
        <circle cx="41" cy="42" r="3" fill="#33303A" />
        <circle cx="59" cy="42" r="3" fill="#33303A" />
        <circle cx="42.2" cy="40.8" r="1" fill="#fff" />
        <circle cx="60.2" cy="40.8" r="1" fill="#fff" />
      </g>
      {/* gold cat-eye glasses (over eyes) */}
      <g stroke="#D8A82E" strokeWidth="2.2" fill="rgba(255,255,255,.14)">
        <path d="M33 38 h13 q1 4 -1 7 q-12 2 -12 -3 q0 -3 0 -4 Z" />
        <path d="M67 38 h-13 q-1 4 1 7 q12 2 12 -3 q0 -3 0 -4 Z" />
      </g>
      <path d="M46 39 q4 -1.5 8 0" stroke="#D8A82E" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M33 38 l-4 -1 M67 38 l4 -1" stroke="#D8A82E" strokeWidth="2" strokeLinecap="round" />
      {/* nose + warm smile */}
      <path d="M49 47 q1 2 2 3" stroke="#D8A57E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M42 53 q8 7 16 0" stroke="#C25C70" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* beauty mark — auntie signature */}
      <circle cx="62" cy="56" r="1" fill="#7A5A48" />
    </svg>
  );
}

const AUNTIE_SAYINGS = [
  "Aiyah, you discard THAT?",
  "Have you eaten yet?",
  "Sit up straight, lah.",
  "I let you win… this time.",
  "When you getting married?",
  "Wah, big hand — pay up!",
  "Your cousin already knows how.",
  "Eat first, play after.",
  "Drink more water, ah.",
  "Slowly slowly, no rush.",
  "Pung! …okay, your turn.",
  "So close! Try again, dear.",
  "Don't be shy, take the last one.",
  "This auntie taught you, remember.",
];

function AuntieSpeech({ interval = 3600, style }) {
  const T = useT();
  const [i, setI] = useState(() => Math.floor(Math.random() * AUNTIE_SAYINGS.length));
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setShow(false);
      setTimeout(() => { setI((p) => (p + 1) % AUNTIE_SAYINGS.length); setShow(true); }, 280);
    }, interval);
    return () => clearInterval(t);
  }, [interval]);
  return (
    <div style={{ position: "relative", display: "inline-block", ...style }}>
      <div className={show ? "ss-bubblein" : "ss-bubbleout"}
        style={{ position: "relative", background: "#fff", color: "#2A2533", fontWeight: 800, fontSize: 14, fontFamily: T.fontBody, padding: "10px 15px", borderRadius: 16, boxShadow: "0 6px 18px rgba(0,0,0,.18)", whiteSpace: "nowrap", border: "2px solid #FFE08A" }}>
        {AUNTIE_SAYINGS[i]}
        <span style={{ position: "absolute", left: 22, bottom: -8, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "9px solid #fff" }} />
        <span style={{ position: "absolute", left: 21, bottom: -11, width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent", borderTop: "10px solid #FFE08A", zIndex: -1 }} />
      </div>
    </div>
  );
}


function SparrowAvatar({ size = 76 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="ss-bob" style={{ display: "block" }}>
      <ellipse cx="50" cy="64" rx="29" ry="25" fill="#B98B5E" />
      <circle cx="50" cy="36" r="23" fill="#B98B5E" />
      <ellipse cx="50" cy="70" rx="16" ry="13" fill="#FFF4E3" />
      <ellipse cx="26" cy="60" rx="9" ry="15" fill="#9C7146" transform="rotate(20 26 60)" />
      <ellipse cx="74" cy="60" rx="9" ry="15" fill="#9C7146" transform="rotate(-20 74 60)" />
      <circle cx="42" cy="34" r="3.6" fill="#33303A" />
      <circle cx="58" cy="34" r="3.6" fill="#33303A" />
      <circle cx="43.3" cy="32.7" r="1.2" fill="#fff" />
      <circle cx="59.3" cy="32.7" r="1.2" fill="#fff" />
      <ellipse cx="33" cy="42" rx="5" ry="3.2" fill="#FFB3C7" />
      <ellipse cx="67" cy="42" rx="5" ry="3.2" fill="#FFB3C7" />
      <polygon points="45.5,40 54.5,40 50,47.5" fill="#F6A623" />
      <path d="M42 88 l-3 7 M58 88 l3 7" stroke="#F6A623" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 15 q5 -9 13 -4" stroke="#9C7146" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function CatAvatar({ size = 76 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="ss-bob" style={{ display: "block" }}>
      <ellipse cx="50" cy="68" rx="27" ry="22" fill="#FFFDF6" stroke="#EAE2D2" strokeWidth="2" />
      <polygon points="29,26 40,14 44,30" fill="#FFFDF6" stroke="#EAE2D2" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="71,26 60,14 56,30" fill="#FFFDF6" stroke="#EAE2D2" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="33,25 39,19 41,27" fill="#FFB3C7" />
      <polygon points="67,25 61,19 59,27" fill="#FFB3C7" />
      <circle cx="50" cy="40" r="23" fill="#FFFDF6" stroke="#EAE2D2" strokeWidth="2" />
      <circle cx="42" cy="38" r="3.4" fill="#33303A" />
      <circle cx="58" cy="38" r="3.4" fill="#33303A" />
      <circle cx="43.2" cy="36.8" r="1.1" fill="#fff" />
      <circle cx="59.2" cy="36.8" r="1.1" fill="#fff" />
      <ellipse cx="33" cy="45" rx="4.8" ry="3" fill="#FFB3C7" />
      <ellipse cx="67" cy="45" rx="4.8" ry="3" fill="#FFB3C7" />
      <path d="M47 45 q3 3 6 0" stroke="#33303A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M24 42 l-9 -2 M24 47 l-9 2 M76 42 l9 -2 M76 47 l9 2" stroke="#C9BFA9" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M32 60 q18 9 36 0" stroke="#E15A54" strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="65" r="5" fill="#FFD978" stroke="#D5A22B" strokeWidth="1.5" />
      <circle cx="76" cy="58" r="8" fill="#FFFDF6" stroke="#EAE2D2" strokeWidth="2" />
      <path d="M73 56 l6 0 M73 60 l6 0" stroke="#FFB3C7" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DragonAvatar({ size = 76 }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="ss-bob" style={{ display: "block" }}>
      <ellipse cx="50" cy="68" rx="26" ry="21" fill="#4FBE8C" />
      <ellipse cx="50" cy="72" rx="14" ry="11" fill="#D9F4E5" />
      <circle cx="50" cy="38" r="23" fill="#4FBE8C" />
      <path d="M36 17 q-2 -10 7 -9 q-1 5 1 8 Z" fill="#FFD978" stroke="#D5A22B" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M64 17 q2 -10 -7 -9 q1 5 -1 8 Z" fill="#FFD978" stroke="#D5A22B" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="42" cy="35" r="3.5" fill="#33303A" />
      <circle cx="58" cy="35" r="3.5" fill="#33303A" />
      <circle cx="43.2" cy="33.8" r="1.1" fill="#fff" />
      <circle cx="59.2" cy="33.8" r="1.1" fill="#fff" />
      <ellipse cx="33" cy="42" rx="4.8" ry="3" fill="#FFB3C7" />
      <ellipse cx="67" cy="42" rx="4.8" ry="3" fill="#FFB3C7" />
      <ellipse cx="50" cy="47" rx="11" ry="7.5" fill="#A8E6C8" />
      <circle cx="46" cy="46" r="1.5" fill="#3E9C72" />
      <circle cx="54" cy="46" r="1.5" fill="#3E9C72" />
      <path d="M28 64 q-9 1 -11 -6" stroke="#4FBE8C" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M72 64 q9 1 11 -6" stroke="#4FBE8C" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const TEACHERS = [
  { id: "auntie", name: "Auntie", title: "the Mahjong Auntie", tag: "Sharp eyes, sharper opinions. She'll get you table-ready.", Comp: AuntieAvatar },
  { id: "mai", name: "Mai", title: "the Sparrow", tag: "The classic. Mahjong literally means “sparrow.”", Comp: SparrowAvatar },
  { id: "bao", name: "Bao", title: "the Lucky Cat", tag: "Brings good fortune to every draw.", Comp: CatAvatar },
  { id: "lung", name: "Lung", title: "the Dragon", tag: "Honor-tile royalty, very humble about it.", Comp: DragonAvatar },
];

/* ---------------- HK scenery: harbour + floating junk ---------------- */

function HarborScene({ width = "100%", height = 64 }) {
  return (
    <svg viewBox="0 0 360 64" width={width} height={height} preserveAspectRatio="xMidYMax slice" style={{ display: "block" }}>
      <defs>
        <linearGradient id="hkSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD9A8" />
          <stop offset="1" stopColor="#FF9DBE" />
        </linearGradient>
      </defs>
      <rect width="360" height="64" fill="url(#hkSky)" />
      <circle cx="300" cy="16" r="9" fill="#FFF3D6" opacity=".9" />
      <g fill="#7A5C8F" opacity=".55">
        <rect x="0" y="26" width="16" height="38" />
        <rect x="20" y="18" width="13" height="46" />
        <rect x="37" y="30" width="18" height="34" />
        <rect x="59" y="12" width="11" height="52" />
        <rect x="74" y="24" width="15" height="40" />
        <rect x="93" y="32" width="20" height="32" />
        <rect x="117" y="16" width="12" height="48" />
        <rect x="133" y="28" width="16" height="36" />
        <rect x="290" y="22" width="14" height="42" />
        <rect x="308" y="30" width="18" height="34" />
        <rect x="330" y="18" width="12" height="46" />
        <rect x="346" y="28" width="14" height="36" />
      </g>
      <rect y="52" width="360" height="12" fill="#5FA8C9" />
      <path d="M0 54 q12 3 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" stroke="#8CC6DF" strokeWidth="1.6" fill="none" />
      <g transform="translate(196 8)">
        <g className="ss-boat">
          <path d="M0 44 q22 10 44 0 l-5 8 q-17 6 -34 0 Z" fill="#5B3A29" />
          <path d="M22 6 v38" stroke="#5B3A29" strokeWidth="2.5" />
          <path d="M22 8 q-19 9 -17 32 q9 -5 17 -4 Z" fill="#C9402F" />
          <path d="M22 8 q19 9 17 32 q-9 -5 -17 -4 Z" fill="#E2553F" />
          <path d="M8 22 h13 M6 30 h15 M27 22 h12 M27 30 h13" stroke="#8C2C20" strokeWidth="1.4" />
        </g>
      </g>
    </svg>
  );
}

/* ---------------- lesson icons (vintage HK set) ---------------- */

function IconTile() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <rect x="9" y="4" width="22" height="32" rx="6" fill="#FFFDF6" stroke="#D9CDB8" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="6.5" fill="none" stroke={SUIT.red} strokeWidth="3.5" />
      <circle cx="20" cy="20" r="2" fill={SUIT.red} />
    </svg>
  );
}
function IconDragon() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <rect x="9" y="4" width="22" height="32" rx="6" fill="#FFFDF6" stroke="#D9CDB8" strokeWidth="2.5" />
      <text x="20" y="27" textAnchor="middle" fontSize="17" fontWeight="700" fill={SUIT.red} fontFamily="'Noto Sans TC',sans-serif">中</text>
    </svg>
  );
}
function IconSteamer() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <path d="M14 6 q1 4 -2 6 M22 4 q1 4 -2 6 M29 7 q1 3 -2 5" stroke="#B9AF9C" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="6" y="14" width="28" height="9" rx="3" fill="#E8C98F" stroke="#B98E4E" strokeWidth="2" />
      <rect x="6" y="26" width="28" height="9" rx="3" fill="#E8C98F" stroke="#B98E4E" strokeWidth="2" />
      <path d="M10 18.5 h20 M10 30.5 h20" stroke="#B98E4E" strokeWidth="1.6" strokeDasharray="3 2.5" />
    </svg>
  );
}
function IconNeonWin() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <rect x="5" y="7" width="30" height="26" rx="7" fill="none" stroke="#FF4D8D" strokeWidth="2.6" />
      <text x="20" y="27" textAnchor="middle" fontSize="15" fontWeight="700" fill="#FF4D8D" fontFamily="'Noto Sans TC',sans-serif">食</text>
      <path d="M9 4 l2 3 M31 4 l-2 3" stroke="#FFC233" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconTaxi() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <path d="M8 22 l3 -7 q1 -2.5 4 -2.5 h10 q3 0 4 2.5 l3 7 Z" fill="#D8D8DC" stroke="#9A9AA2" strokeWidth="1.6" />
      <rect x="5" y="21" width="30" height="9" rx="3.5" fill="#C9402F" stroke="#9E2C1E" strokeWidth="1.8" />
      <rect x="15" y="8" width="10" height="5" rx="1.5" fill="#FFC233" stroke="#C28F12" strokeWidth="1.4" />
      <rect x="13" y="15" width="6" height="5" rx="1" fill="#BFE3F2" />
      <rect x="21" y="15" width="6" height="5" rx="1" fill="#BFE3F2" />
      <circle cx="12" cy="31" r="3.6" fill="#3A3A40" /><circle cx="12" cy="31" r="1.4" fill="#D8D8DC" />
      <circle cx="28" cy="31" r="3.6" fill="#3A3A40" /><circle cx="28" cy="31" r="1.4" fill="#D8D8DC" />
    </svg>
  );
}
function IconPung() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <path d="M6 8 h28 q3 0 3 3 v14 q0 3 -3 3 h-15 l-7 7 v-7 h-6 q-3 0 -3 -3 v-14 q0 -3 3 -3 Z" fill="#FFFDF6" stroke="#00A87E" strokeWidth="2.4" />
      <text x="21" y="23" textAnchor="middle" fontSize="14" fontWeight="700" fill="#00A87E" fontFamily="'Noto Sans TC',sans-serif">碰!</text>
    </svg>
  );
}
function IconFan() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <circle cx="14" cy="24" r="8" fill="#FBE3A1" stroke="#B8860B" strokeWidth="2" />
      <circle cx="22" cy="20" r="8" fill="#FBE3A1" stroke="#B8860B" strokeWidth="2" />
      <text x="22" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#B8860B" fontFamily="'Noto Sans TC',sans-serif">番</text>
      <path d="M28 9 l1.6 3.4 3.4 .4 -2.5 2.4 .7 3.6 -3.2 -1.8 -3.2 1.8 .7 -3.6 -2.5 -2.4 3.4 -.4 Z" fill="#FFC233" />
    </svg>
  );
}
function IconMoneyHand() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <rect x="5" y="11" width="9" height="20" rx="2.5" fill="#FFFDF6" stroke="#C0392B" strokeWidth="2" transform="rotate(-10 9 21)" />
      <rect x="15" y="9" width="9" height="20" rx="2.5" fill="#FFFDF6" stroke="#C0392B" strokeWidth="2" />
      <rect x="25" y="11" width="9" height="20" rx="2.5" fill="#FFFDF6" stroke="#C0392B" strokeWidth="2" transform="rotate(10 30 21)" />
      <text x="19.5" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#C0392B" fontFamily="'Noto Sans TC',sans-serif">大</text>
    </svg>
  );
}
function IconSeat() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <circle cx="20" cy="20" r="15" fill="#FFFDF6" stroke="#2E86C1" strokeWidth="2" />
      <polygon points="20,7 24,20 20,18 16,20" fill="#2E86C1" />
      <polygon points="20,33 16,20 20,22 24,20" fill="#9CC9E8" />
      <text x="20" y="5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#2E86C1" fontFamily="'Noto Sans TC',sans-serif">東</text>
    </svg>
  );
}
function IconKong() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      {[6, 13, 20, 27].map((x, i) => (
        <rect key={i} x={x} y={10} width="6.5" height="20" rx="2" fill="#FFFDF6" stroke="#16A085" strokeWidth="1.8" />
      ))}
      <text x="20" y="8" textAnchor="middle" fontSize="7" fontWeight="700" fill="#16A085" fontFamily="'Noto Sans TC',sans-serif">槓</text>
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <path d="M20 5 l12 4 v9 c0 8 -5 13 -12 16 c-7 -3 -12 -8 -12 -16 v-9 Z" fill="#EFE3F5" stroke="#7D3C98" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 20 l4 4 8 -8" fill="none" stroke="#7D3C98" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrophy() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32">
      <path d="M12 8 h16 v6 c0 5 -3.5 8 -8 8 s-8 -3 -8 -8 Z" fill="#FFE7B0" stroke="#D35400" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10 h-4 v3 c0 3 2 4 4 4 M28 10 h4 v3 c0 3 -2 4 -4 4" fill="none" stroke="#D35400" strokeWidth="2" strokeLinecap="round" />
      <rect x="17" y="22" width="6" height="6" fill="#E8A04E" />
      <rect x="12" y="28" width="16" height="4" rx="1.5" fill="#D35400" />
    </svg>
  );
}

/* ---------------- TILE FACES (SVG 60x80) ---------------- */

function Dot({ cx, cy, r, color }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={r * 0.55} />
      <circle cx={cx} cy={cy} r={r * 0.32} fill={color} />
    </g>
  );
}

function DotsFace({ n }) {
  const L = {
    1: [[30, 40, 13, SUIT.red]],
    2: [[30, 22, 9, SUIT.blue], [30, 58, 9, SUIT.green]],
    3: [[16, 18, 8, SUIT.blue], [30, 40, 8, SUIT.red], [44, 62, 8, SUIT.green]],
    4: [[18, 22, 8, SUIT.blue], [42, 22, 8, SUIT.green], [18, 58, 8, SUIT.green], [42, 58, 8, SUIT.blue]],
    5: [[16, 18, 7, SUIT.blue], [44, 18, 7, SUIT.green], [30, 40, 7, SUIT.red], [16, 62, 7, SUIT.green], [44, 62, 7, SUIT.blue]],
    6: [[20, 18, 7, SUIT.green], [40, 18, 7, SUIT.green], [20, 40, 7, SUIT.red], [40, 40, 7, SUIT.red], [20, 62, 7, SUIT.red], [40, 62, 7, SUIT.red]],
    7: [[16, 16, 6, SUIT.green], [30, 20, 6, SUIT.green], [44, 24, 6, SUIT.green], [20, 46, 6, SUIT.red], [40, 46, 6, SUIT.red], [20, 64, 6, SUIT.red], [40, 64, 6, SUIT.red]],
    8: [[20, 14, 6, SUIT.blue], [40, 14, 6, SUIT.blue], [20, 32, 6, SUIT.blue], [40, 32, 6, SUIT.blue], [20, 50, 6, SUIT.blue], [40, 50, 6, SUIT.blue], [20, 66, 6, SUIT.blue], [40, 66, 6, SUIT.blue]],
    9: [[17, 18, 5.6, SUIT.blue], [30, 18, 5.6, SUIT.blue], [43, 18, 5.6, SUIT.blue], [17, 40, 5.6, SUIT.red], [30, 40, 5.6, SUIT.red], [43, 40, 5.6, SUIT.red], [17, 62, 5.6, SUIT.green], [30, 62, 5.6, SUIT.green], [43, 62, 5.6, SUIT.green]],
  };
  return <g>{(L[n] || L[1]).map((d, i) => <Dot key={i} cx={d[0]} cy={d[1]} r={d[2]} color={d[3]} />)}</g>;
}

function Stick({ x, y, color }) {
  return (
    <g>
      <rect x={x - 3.2} y={y - 9} width={6.4} height={18} rx={3} fill={color} />
      <rect x={x - 3.2} y={y - 1} width={6.4} height={2} fill="#FFFDF9" opacity="0.85" />
      <circle cx={x} cy={y - 9} r={2.4} fill={color} />
      <circle cx={x} cy={y + 9} r={2.4} fill={color} />
    </g>
  );
}

function BirdFace() {
  return (
    <g>
      <ellipse cx="30" cy="46" rx="15" ry="13" fill="#B98B5E" />
      <circle cx="30" cy="30" r="11.5" fill="#B98B5E" />
      <ellipse cx="30" cy="50" rx="8.5" ry="7" fill="#FFF4E3" />
      <ellipse cx="18.5" cy="44" rx="5" ry="8.5" fill="#9C7146" transform="rotate(18 18.5 44)" />
      <circle cx="26" cy="29" r="1.9" fill="#33303A" />
      <circle cx="34" cy="29" r="1.9" fill="#33303A" />
      <circle cx="26.7" cy="28.3" r="0.6" fill="#fff" />
      <circle cx="34.7" cy="28.3" r="0.6" fill="#fff" />
      <ellipse cx="21.5" cy="33.5" rx="2.6" ry="1.7" fill="#FFB3C7" />
      <ellipse cx="38.5" cy="33.5" rx="2.6" ry="1.7" fill="#FFB3C7" />
      <polygon points="27.6,32.2 32.4,32.2 30,36.4" fill="#F6A623" />
      <path d="M26 59 l-2 5 M34 59 l2 5" stroke="#F6A623" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 18 q3 -6 8 -3" stroke="#9C7146" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

function BambooFace({ n }) {
  if (n === 1) return <BirdFace />;
  const L = {
    2: [[30, 24], [30, 56]],
    3: [[30, 20], [19, 56], [41, 56]],
    4: [[19, 24], [41, 24], [19, 56], [41, 56]],
    5: [[19, 22], [41, 22], [30, 40], [19, 58], [41, 58]],
    6: [[19, 24], [30, 24], [41, 24], [19, 56], [30, 56], [41, 56]],
    7: [[30, 18], [19, 42], [30, 42], [41, 42], [19, 64], [30, 64], [41, 64]],
    8: [[19, 18], [41, 18], [19, 40], [41, 40], [30, 29], [30, 51], [19, 62], [41, 62]],
    9: [[19, 18], [30, 18], [41, 18], [19, 40], [30, 40], [41, 40], [19, 62], [30, 62], [41, 62]],
  };
  return <g>{(L[n] || L[2]).map((p, i) => <Stick key={i} x={p[0]} y={p[1]} color={n === 5 && i === 2 ? SUIT.red : SUIT.green} />)}</g>;
}

function CharFace({ n }) {
  return (
    <g fontFamily="'Noto Sans TC','PingFang TC',sans-serif" fontWeight="700" textAnchor="middle">
      <text x="30" y="34" fontSize="26" fill={SUIT.blue}>{NUM_CN[n]}</text>
      <text x="30" y="66" fontSize="27" fill={SUIT.red}>萬</text>
    </g>
  );
}

function WindFace({ c }) {
  return (
    <text x="30" y="55" textAnchor="middle" fontSize="40" fontWeight="700" fill={SUIT.blue} fontFamily="'Noto Sans TC','PingFang TC',sans-serif">{c}</text>
  );
}

function DragonFace({ d }) {
  if (d === "r") return <text x="30" y="55" textAnchor="middle" fontSize="40" fontWeight="700" fill={SUIT.red} fontFamily="'Noto Sans TC',sans-serif">中</text>;
  if (d === "g") return <text x="30" y="55" textAnchor="middle" fontSize="40" fontWeight="700" fill={SUIT.green} fontFamily="'Noto Sans TC',sans-serif">發</text>;
  return <rect x="13" y="11" width="34" height="58" rx="6" fill="none" stroke={SUIT.blue} strokeWidth="4.5" />;
}

function FlowerFace({ c, col }) {
  return (
    <g>
      <g transform="translate(30 22)" opacity="0.9">
        {[0, 72, 144, 216, 288].map((a, i) => (
          <ellipse key={i} cx="0" cy="-8" rx="4.2" ry="7" fill={col} transform={`rotate(${a})`} opacity="0.85" />
        ))}
        <circle cx="0" cy="0" r="3.6" fill="#F6C544" />
      </g>
      <text x="30" y="64" textAnchor="middle" fontSize="24" fontWeight="700" fill={col} fontFamily="'Noto Sans TC','PingFang TC',sans-serif">{c}</text>
    </g>
  );
}

function TileFace({ t }) {
  if (t.s === "flower") return <FlowerFace c={t.c} col={t.col || SUIT.red} />;
  if (t.s === "dots") return <DotsFace n={t.n} />;
  if (t.s === "bamboo") return <BambooFace n={t.n} />;
  if (t.s === "char") return <CharFace n={t.n} />;
  if (t.s === "wind") return <WindFace c={t.c} />;
  return <DragonFace d={t.d} />;
}

/* ---------------- tiles: full, mini, gap ---------------- */

function Tile({ t, size = 88, state = "idle", onTap, label, deal = 0 }) {
  const T = useT();
  const ring =
    state === "selected" || state === "correct"
      ? `0 0 0 4px ${T.success}`
      : state === "wrong"
      ? `0 0 0 4px ${T.danger}`
      : "0 0 0 0 rgba(0,0,0,0)";
  return (
    <div className="ss-deal" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animationDelay: `${deal * 75}ms` }}>
      <button
        onClick={onTap ? () => { clack(); onTap(); } : undefined}
        className={`ss-tile ${state === "wrong" ? "ss-shake" : ""} ${state === "correct" || state === "selected" ? "ss-pop" : ""}`}
        style={{
          width: size, height: size * 1.3,
          background: TILE.face,
          border: `1.5px solid ${TILE.edge}`,
          borderRadius: size * 0.18,
          boxShadow: `0 ${Math.max(5, size * 0.075)}px 0 ${TILE.shadow}, ${ring}`,
          cursor: onTap ? "pointer" : "default",
          padding: 0, position: "relative",
          transition: "box-shadow .18s ease, transform .18s cubic-bezier(.34,1.56,.64,1)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg viewBox="0 0 60 80" width="100%" height="100%" style={{ display: "block" }}>
          <TileFace t={t} />
        </svg>
        {T.sparkle && (state === "correct" || state === "selected") && (
          <span className="ss-sparkle" style={{ position: "absolute", top: -12, right: -10, fontSize: 19, color: T.star }}>✦</span>
        )}
      </button>
      {label && <span style={{ fontSize: 14, fontWeight: 700, color: T.sub }}>{label}</span>}
    </div>
  );
}

function MiniTile({ t, size = 42 }) {
  return (
    <div style={{
      width: size, height: size * 1.28, flexShrink: 0,
      background: TILE.face, border: `1.5px solid ${TILE.edge}`,
      borderRadius: size * 0.16,
      boxShadow: `0 ${Math.max(2, size * 0.06)}px 0 ${TILE.shadow}`,
    }}>
      <svg viewBox="0 0 60 80" width="100%" height="100%" style={{ display: "block" }}><TileFace t={t} /></svg>
    </div>
  );
}

function GapTile({ size = 64 }) {
  const T = useT();
  return (
    <div className="ss-gappulse" style={{
      width: size, height: size * 1.28, flexShrink: 0,
      border: `2.5px dashed ${T.primary}`,
      borderRadius: size * 0.16,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: T.primary, fontSize: size * 0.42, fontWeight: 800,
    }}>?</div>
  );
}

function TileBack({ size = 40 }) {
  return (
    <div style={{
      width: size, height: size * 1.3, borderRadius: size * 0.16,
      background: "linear-gradient(135deg,#3FA877,#2E8C60)", border: "1.5px solid #246E4B",
      boxShadow: `0 ${Math.max(3, size * 0.07)}px 0 #1F6B49`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ width: "55%", height: "55%", borderRadius: 5, border: "1.5px solid rgba(255,255,255,.35)" }} />
    </div>
  );
}

/* ---------------- step visuals (fill teach screens) ---------------- */

function FlowVisual() {
  const T = useT();
  const D5 = { s: "dots", n: 5 }, C2 = { s: "char", n: 2 }, B7 = { s: "bamboo", n: 7 }, W = { s: "wind", c: "北" };
  const card = (label, sub, body, i) => (
    <div className="ss-deal" style={{ animationDelay: `${i * 130}ms`, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "12px 12px 10px", textAlign: "center", boxShadow: T.cardShadow, minWidth: 92 }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 2, minHeight: 52, alignItems: "center" }}>{body}</div>
      <div style={{ fontWeight: 800, fontSize: 14, color: T.ink, marginTop: 8, fontFamily: T.fontDisplay }}>{label}</div>
      <div style={{ fontSize: 11, color: T.sub, marginTop: 1 }}>{sub}</div>
    </div>
  );
  const arrow = (k) => <span key={k} style={{ color: T.primary, fontSize: 24, fontWeight: 800 }}>→</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
      {card("Draw", "from the wall", <TileBack size={32} />, 0)}
      {arrow("a1")}
      {card("Choose", "your worst tile", <><MiniTile t={C2} size={24} /><MiniTile t={B7} size={24} /><div style={{ boxShadow: `0 0 0 2.5px ${T.danger}`, borderRadius: 5 }}><MiniTile t={W} size={24} /></div></>, 1)}
      {arrow("a2")}
      {card("Discard", "to the pond", <MiniTile t={W} size={32} />, 2)}
    </div>
  );
}

function PondVisual({ tidy = false }) {
  const T = useT();
  const tiles = [{ s: "dots", n: 3 }, { s: "bamboo", n: 7 }, { s: "wind", c: "北" }, { s: "char", n: 1 }, { s: "dots", n: 9 }, { s: "dragon", d: "w" }, { s: "bamboo", n: 2 }, { s: "char", n: 5 }];
  const rot = [-6, 4, -3, 7, -5, 2, -2, 5];
  return (
    <div style={{ background: "rgba(0,0,0,.05)", borderRadius: 16, padding: 14, maxWidth: 280, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
      {tiles.map((t, i) => (
        <div key={i} className="ss-deal" style={{ animationDelay: `${i * 55}ms`, transform: tidy ? "none" : `rotate(${rot[i]}deg)` }}>
          <MiniTile t={t} size={34} />
        </div>
      ))}
    </div>
  );
}

function DealerVisual() {
  const T = useT();
  const seat = (x, y, lbl, active) => (
    <g>
      <circle cx={x} cy={y} r="15" fill={active ? T.primary : "#fff"} stroke={active ? T.primary : "#CBD3DA"} strokeWidth="2.5" />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={active ? "#fff" : "#8A93A0"} fontFamily="'Noto Sans TC',sans-serif">{lbl}</text>
    </g>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg viewBox="0 0 160 130" width="200" height="162">
        <rect x="44" y="40" width="72" height="55" rx="10" fill="#1F7A55" stroke="#16603F" strokeWidth="2" />
        {seat(80, 22, "北", false)}
        {seat(138, 67, "西", false)}
        {seat(80, 112, "東", true)}
        {seat(22, 67, "南", false)}
        <text x="80" y="72" textAnchor="middle" fontSize="13" fontWeight="800" fill="#EAFBF1" fontFamily="sans-serif">×2</text>
      </svg>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.primary }}>東 East = dealer · plays for double</div>
    </div>
  );
}

function FireVisual() {
  const T = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div style={{ textAlign: "center" }}>
        <MiniTile t={{ s: "bamboo", n: 9 }} size={40} />
        <div style={{ fontSize: 11, color: T.sub, marginTop: 4, fontWeight: 700 }}>your discard</div>
      </div>
      <span className="ss-gappulse" style={{ color: T.danger, fontSize: 26, fontWeight: 800 }}>→</span>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: T.dangerSoft, border: `2px solid ${T.danger}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto" }}>🀄</div>
        <div style={{ fontSize: 11, color: T.danger, marginTop: 4, fontWeight: 800 }}>出銃 — you pay!</div>
      </div>
    </div>
  );
}

function WallVisual() {
  const T = useT();
  const row = (n, horizontal) => (
    <div style={{ display: "flex", flexDirection: horizontal ? "row" : "column", gap: 2 }}>
      {Array.from({ length: n }).map((_, i) => <TileBack key={i} size={horizontal ? 16 : 16} />)}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {row(7, true)}
      <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
        {row(4, false)}
        <span style={{ fontSize: 22 }}>🀄</span>
        {row(4, false)}
      </div>
      {row(7, true)}
      <div style={{ fontSize: 12, color: T.sub, fontWeight: 700, marginTop: 4 }}>Four walls, built into a square</div>
    </div>
  );
}

function DiceVisual() {
  const T = useT();
  const die = (pips) => (
    <div style={{ width: 46, height: 46, borderRadius: 11, background: "#fff", border: `1.5px solid ${T.cardBorder}`, boxShadow: T.cardShadow, position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", padding: 7 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {pips.includes(i) && <span style={{ width: 7, height: 7, borderRadius: "50%", background: i === 4 ? T.danger : T.ink }} />}
        </span>
      ))}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <div className="ss-deal">{die([0, 2, 4, 6, 8])}</div>
      <div className="ss-deal" style={{ animationDelay: "120ms" }}>{die([0, 2, 6, 8])}</div>
      <span style={{ fontSize: 13, fontWeight: 800, color: T.sub, marginLeft: 6 }}>Roll to break the wall</span>
    </div>
  );
}

function StepVisual({ name }) {
  if (name === "flow") return <FlowVisual />;
  if (name === "pond") return <PondVisual />;
  if (name === "dealer") return <DealerVisual />;
  if (name === "fire") return <FireVisual />;
  if (name === "wall") return <WallVisual />;
  if (name === "dice") return <DiceVisual />;
  if (name === "priority") return <PriorityVisual />;
  if (name === "manners") return <MannersVisual />;
  return null;
}

function PriorityVisual() {
  const T = useT();
  const rows = [
    { cn: "食", en: "Win", note: "always eats first", rank: 1, color: T.star },
    { cn: "碰", en: "Pung", note: "beats a chow", rank: 2, color: T.primary },
    { cn: "上", en: "Chow", note: "lowest priority", rank: 3, color: T.sub },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, maxWidth: 280, margin: "0 auto", width: "100%" }}>
      {rows.map((r, i) => (
        <React.Fragment key={r.cn}>
          <div className="ss-deal" style={{ animationDelay: `${i * 120}ms`, display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 14, padding: "11px 14px", boxShadow: T.cardShadow }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: r.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, fontFamily: "'Noto Sans TC',sans-serif", flexShrink: 0 }}>{r.cn}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: T.ink, fontFamily: T.fontDisplay }}>{r.en}</div>
              <div style={{ fontSize: 12.5, color: T.sub }}>{r.note}</div>
            </div>
            <span style={{ fontWeight: 800, color: T.sub, fontSize: 13 }}>#{r.rank}</span>
          </div>
          {i < 2 && <div style={{ textAlign: "center", color: T.sub, fontWeight: 800, fontSize: 15 }}>beats ⌄</div>}
        </React.Fragment>
      ))}
    </div>
  );
}

function MannersVisual() {
  const T = useT();
  const items = [
    ["✓", "Discard tidily into the pond", true],
    ["✓", "Announce calls clearly — 碰! 食糊!", true],
    ["✓", "Settle up promptly", true],
    ["✕", "Reaching into others' tiles", false],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300, margin: "0 auto", width: "100%" }}>
      {items.map((it, i) => (
        <div key={i} className="ss-deal" style={{ animationDelay: `${i * 90}ms`, display: "flex", alignItems: "center", gap: 11, background: T.card, border: `1.5px solid ${it[2] ? T.cardBorder : T.danger + "55"}`, borderRadius: 13, padding: "11px 13px", boxShadow: T.cardShadow }}>
          <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: it[2] ? T.successSoft : T.dangerSoft, color: it[2] ? T.successDeep : T.danger, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>{it[0]}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: it[2] ? T.ink : T.sub, textDecoration: it[2] ? "none" : "line-through" }}>{it[1]}</span>
        </div>
      ))}
    </div>
  );
}


/* ---------------- shared UI ---------------- */

function Btn({ children, onClick, disabled, tone = "primary", style }) {
  const T = useT();
  const bg = disabled ? T.locked : tone === "success" ? T.success : T.primary;
  const deep = tone === "success" ? T.successDeep : T.primaryDeep;
  return (
    <button
      onClick={onClick} disabled={disabled} className="ss-btn"
      style={{
        width: "100%", minHeight: 58, padding: "16px 18px",
        fontSize: 18.5, fontWeight: 800, fontFamily: T.fontBody,
        textTransform: T.upper ? "uppercase" : "none",
        letterSpacing: T.upper ? ".05em" : "0",
        color: disabled ? "#ABABAB" : "#fff",
        background: bg, border: "none",
        borderRadius: T.btnEdge ? 18 : 999,
        boxShadow: disabled
          ? T.btnEdge ? `0 4px 0 ${T.lockedEdge}` : "none"
          : T.btnEdge ? `0 4px 0 ${deep}` : `0 2px 12px ${bg}55`,
        cursor: disabled ? "default" : "pointer",
        transition: "transform .12s ease, box-shadow .12s ease, opacity .12s ease, background .2s ease",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function CardBox({ children, style, onClick, selected }) {
  const T = useT();
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        border: `1.5px solid ${selected ? T.primary : T.cardBorder}`,
        borderRadius: T.radius,
        boxShadow: selected ? `0 0 0 2px ${T.primary}, ${T.cardShadow}` : T.cardShadow,
        backdropFilter: T.glass ? "blur(18px)" : undefined,
        WebkitBackdropFilter: T.glass ? "blur(18px)" : undefined,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow .15s ease, border-color .15s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function TeacherSays({ teacher, children }) {
  const T = useT();
  const A = teacher.Comp;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <A size={74} />
      <div style={{
        background: T.card, border: `1.5px solid ${T.cardBorder}`,
        borderRadius: T.bubbleRadius, padding: "13px 15px",
        fontSize: 16, lineHeight: 1.55, color: T.ink,
        boxShadow: T.cardShadow,
        backdropFilter: T.glass ? "blur(18px)" : undefined,
        flex: 1,
      }}>
        {children}
      </div>
    </div>
  );
}

/* ---------------- mnemonic cards ---------------- */

function Ghost({ g }) {
  const T = useT();
  if (g.k === "target") {
    return (
      <svg viewBox="0 0 60 60" width="58" height="58" style={{ opacity: 0.22 }}>
        <circle cx="30" cy="30" r="24" fill="none" stroke={SUIT.red} strokeWidth="4" />
        <circle cx="30" cy="30" r="13" fill="none" stroke={SUIT.red} strokeWidth="4" />
        <circle cx="30" cy="30" r="4" fill={SUIT.red} />
      </svg>
    );
  }
  if (g.k === "frame") {
    return <div style={{ width: 38, height: 54, border: `3px dashed ${SUIT.blue}`, borderRadius: 7, opacity: 0.3 }} />;
  }
  return (
    <span style={{
      fontSize: 58, fontWeight: 800, color: g.color || T.primary, opacity: 0.16,
      transform: g.rot ? `rotate(${g.rot}deg)` : "none", lineHeight: 1,
      fontFamily: "'Baloo 2','Nunito',sans-serif",
    }}>{g.v}</span>
  );
}

function MnemoCard({ card, tapped, onTap }) {
  const T = useT();
  return (
    <button
      onClick={() => { clack(); onTap(); }}
      className={`ss-deal ${tapped ? "ss-pop" : ""}`}
      style={{
        position: "relative", overflow: "hidden",
        background: TILE.face, border: `1.5px solid ${tapped ? T.success : TILE.edge}`,
        borderRadius: 16, boxShadow: `0 3.5px 0 ${TILE.shadow}${tapped ? `, 0 0 0 3px ${T.success}` : ""}`,
        padding: "10px 6px 9px", minHeight: 118,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        fontFamily: "inherit",
        transition: "box-shadow .15s ease, border-color .15s ease",
      }}
    >
      <div style={{ position: "absolute", top: 4, left: 0, right: 0, height: 64, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <Ghost g={card.ghost} />
      </div>
      <span style={{ position: "relative", fontSize: 37, fontWeight: 700, lineHeight: "60px", height: 60, color: card.color || T.ink, fontFamily: "'Noto Sans TC','PingFang TC',sans-serif" }}>
        {card.ch}
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginTop: 1 }}>{card.name}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.sub, lineHeight: 1.3, textAlign: "center", marginTop: 2 }}>{card.tip}</span>
    </button>
  );
}

/* ---------------- LESSON CONTENT ---------------- */

const NUM_MNEMO = [
  { ch: "一", ghost: { k: "t", v: "1" }, name: "1", tip: "one stroke" },
  { ch: "二", ghost: { k: "t", v: "2" }, name: "2", tip: "two strokes" },
  { ch: "三", ghost: { k: "t", v: "3" }, name: "3", tip: "three strokes" },
  { ch: "四", ghost: { k: "t", v: "4" }, name: "4", tip: "a window, four panes" },
  { ch: "五", ghost: { k: "t", v: "5" }, name: "5", tip: "a blocky, squared 5" },
  { ch: "六", ghost: { k: "t", v: "6" }, name: "6", tip: "a roof over two legs" },
  { ch: "七", ghost: { k: "t", v: "7", rot: 180 }, name: "7", tip: "an upside-down 7" },
  { ch: "八", ghost: { k: "t", v: "8" }, name: "8", tip: "an 8 split in half" },
  { ch: "九", ghost: { k: "t", v: "9" }, name: "9", tip: "a 9 kicking a leg out" },
];

const WIND_MNEMO = [
  { ch: "東", ghost: { k: "t", v: "E" }, name: "East", tip: "sun rising behind a tree" },
  { ch: "南", ghost: { k: "t", v: "S" }, name: "South", tip: "a lantern in the warm south" },
  { ch: "西", ghost: { k: "t", v: "W" }, name: "West", tip: "a bird in its nest at dusk" },
  { ch: "北", ghost: { k: "t", v: "N" }, name: "North", tip: "two people back-to-back, cold" },
];

const DRAGON_MNEMO = [
  { ch: "中", color: SUIT.red, ghost: { k: "target" }, name: "Red 中", tip: "an arrow through the bullseye — “centre”" },
  { ch: "發", color: SUIT.green, ghost: { k: "t", v: "$", color: SUIT.green }, name: "Green 發", tip: "“prosper” — green like money" },
  { ch: "白", ghost: { k: "frame" }, name: "White 白", tip: "a blank canvas — the empty tile" },
];

const LESSON_CONTENT = {
  1: [
    {
      type: "teach", title: "Welcome to Mahjong Auntie",
      say: (t) => <>Mahjong's Cantonese name, <b>maa zeuk 麻雀</b>, literally means <b>"sparrow"</b> — shuffling tiles sounds like sparrows chattering. I'm <b>{t.name}</b>, and I'll get you table-ready, one tile at a time.</>,
      tiles: [D(1)], note: "Tap the tile to give it a poke.", requireAll: false,
    },
    {
      type: "teach", title: "The three suits",
      say: () => <>Most of the 144 tiles belong to one of <b>three suits</b>, each numbered 1–9. Tap each tile to meet it.</>,
      tiles: [D(5), B(3), Ch(5)], captions: ["Dots", "Bamboo", "Characters"], requireAll: true,
    },
    {
      type: "pickOne", prompt: "Which tile is from the Dots suit?",
      tiles: [B(4), D(2), Ch(3)], correct: 1, hint: "Dots tiles show circles.",
    },
    {
      type: "teach", title: "Bamboo's little secret",
      say: () => <>The <b>1 of Bamboo</b> doesn't show a stick — it shows a <b>bird</b>. (A sparrow, naturally. We're everywhere.) Every other Bamboo tile shows its number in sticks.</>,
      tiles: [B(1), B(2), B(5)], captions: ["1 Bamboo", "2 Bamboo", "5 Bamboo"], requireAll: true,
    },
    {
      type: "pickMany", prompt: "Tap all three Bamboo tiles",
      tiles: [D(4), B(2), Ch(1), B(5), D(1), B(1)], correct: [1, 3, 5],
      hint: "Sticks count — and don't forget the bird.",
    },
    {
      type: "mnemo", title: "Crack the number code",
      say: () => <>Don't memorize — <b>squint</b>. A familiar number hides inside every character. (And honestly: most of mahjong is <i>matching identical tiles</i>, not reading. The numbers only matter for runs.)</>,
      cards: NUM_MNEMO,
    },
    {
      type: "pickOne", prompt: "What number is this Character tile?",
      tiles: [Ch(5)], big: true, choices: ["3", "5", "7"], correct: 1,
      hint: "五 — the blocky, squared-off 5.",
    },
    {
      type: "pickOne", prompt: "Find the 7 (七)",
      tiles: [Ch(8), Ch(7), Ch(9)], correct: 1,
      hint: "Flip a 7 upside-down.",
    },
    {
      type: "pickMany", prompt: "Last drill — tap the two Dots tiles",
      tiles: [Ch(2), D(6), B(3), D(3), B(1), Ch(9)], correct: [1, 3],
      hint: "Circles only.",
    },
  ],
  2: [
    {
      type: "teach", title: "Beyond the suits",
      say: () => <>Not every tile has a number. <b>Honor tiles</b> — four Winds and three Dragons — stand alone. They never form runs, only pairs and triplets. Meet your first two.</>,
      tiles: [W("東"), Dr("r")], captions: ["East wind 東", "Red dragon 中"], requireAll: true,
    },
    {
      type: "mnemo", title: "The four winds",
      say: () => <>One wind per seat at the table. Each character has a little story — tap the cards:</>,
      cards: WIND_MNEMO,
    },
    {
      type: "pickOne", prompt: "Which tile is the East wind?",
      tiles: [W("南"), W("東"), W("北")], correct: 1,
      hint: "東 — the sun rising behind a tree.",
    },
    {
      type: "mnemo", title: "The three dragons",
      say: () => <>Three dragons, three stories. A triplet of <i>any</i> dragon always scores:</>,
      cards: DRAGON_MNEMO,
    },
    {
      type: "pickMany", prompt: "Tap the two Dragon tiles",
      tiles: [W("西"), Dr("g"), D(3), Dr("w"), W("北"), Ch(7)], correct: [1, 3],
      hint: "Money-green 發 and the blank frame. Winds don't count!",
    },
    {
      type: "pickOne", prompt: "Which dragon is this?",
      tiles: [Dr("g")], big: true, choices: ["Red", "Green", "White"], correct: 1,
      hint: "發 means “prosper” — green like money.",
    },
    {
      type: "teach", title: "Bonus tiles: Flowers 花",
      say: () => <>One last family — <b>Flowers</b> and <b>Seasons</b>. You don't play these into your hand. Draw one, and you just <b>set it aside face-up and draw a replacement</b>. They're free bonus points at the end. Pretty, no suit, no number? Lay it down, draw again.</>,
      tiles: [Fl("春", SUIT.green), Fl("梅", SUIT.red), Fl("秋", "#C77800")],
      captions: ["Spring 春", "Plum 梅", "Autumn 秋"], requireAll: true,
      note: "8 flowers in the set — that's why there are 144 tiles in all.",
    },
    {
      type: "pickOne", prompt: "You draw this. What do you do?",
      tiles: [Fl("竹", SUIT.green)], big: true, stack: true,
      choices: ["Set it aside & draw again", "Add it to my hand", "Discard it"], correct: 0,
      hint: "Flowers never live in your hand — set aside, redraw, pocket the bonus.",
    },
    {
      type: "pickMany", prompt: "Final — tap all three honor tiles",
      tiles: [B(4), W("南"), Ch(5), Dr("r"), D(2), W("東")], correct: [1, 3, 5],
      hint: "Winds and dragons — anything without a number.",
    },
  ],
  3: [
    {
      type: "teach", title: "Three ways tiles snap together",
      say: () => <>Every mahjong hand is built from just <b>three shapes</b>. This is the game's entire vocabulary:</>,
      groups: [
        { label: "Pair · 2 identical", tiles: [Dr("g"), Dr("g")] },
        { label: "Pung 碰 · 3 identical", tiles: [D(5), D(5), D(5)] },
        { label: "Chow 上 · 3 in a row, same suit", tiles: [B(2), B(3), B(4)] },
      ],
    },
    {
      type: "pickSet", prompt: "Tap the Pung",
      options: [
        { tiles: [Ch(2), Ch(3), Ch(4)] },
        { tiles: [B(6), B(6), B(6)] },
        { tiles: [W("東"), W("南"), W("西")] },
      ],
      correct: 1, hint: "Three identical tiles — sticks, in this case. Three different winds are just… three winds.",
    },
    {
      type: "teach", title: "Chow rules",
      say: () => <>A Chow is three <b>consecutive numbers in the same suit</b>. Numbers only — winds and dragons never chow. And 2 Dots–3 Bamboo–4 Characters? That's not a chow, that's a mess.</>,
      tiles: [Ch(4), Ch(5), Ch(6)], captions: ["4", "5", "6"], requireAll: false,
      note: "A proper chow: 4-5-6 of Characters.",
    },
    {
      type: "pickSet", prompt: "Tap the real Chow",
      options: [
        { tiles: [D(1), B(2), Ch(3)] },
        { tiles: [D(7), D(7), D(7)] },
        { tiles: [D(4), D(5), D(6)] },
      ],
      correct: 2, hint: "Same suit, marching in order. Mixed suits don't march together.",
    },
    {
      type: "pickOne", prompt: "Complete the Pung",
      context: [B(8), B(8), "gap"],
      tiles: [D(8), B(8), B(7)], correct: 1,
      hint: "Identical means identical — same suit, same number.",
    },
    {
      type: "pickOne", prompt: "Fill the gap in this Chow",
      context: [Ch(2), "gap", Ch(4)],
      tiles: [Ch(3), D(3), Ch(5)], correct: 0,
      hint: "2 … 4 — what's missing, in Characters?",
    },
    {
      type: "pickSet", prompt: "Tap the Pair",
      options: [
        { tiles: [W("北"), W("北")] },
        { tiles: [D(5), D(6)] },
        { tiles: [Dr("r"), Dr("g")] },
      ],
      correct: 0, hint: "Twins only. Two different dragons are just two dragons.",
    },
    {
      type: "findSet", prompt: "Real hands arrive unsorted. Find the Chow.",
      say: () => <>At a table, nobody hands you neat groups — you sort your own mess. Tap the <b>three tiles that make a chow</b> (a run in one suit).</>,
      tiles: [Dr("g"), D(6), W("東"), D(4), B(2), D(5)], correct: [1, 3, 5],
      hint: "4-5-6 of Dots is hiding in there. Same suit, in a row.",
    },
  ],
  4: [
    {
      type: "teach", title: "The winning formula",
      say: () => <>A winning hand = <b>4 sets + 1 pair</b> = 14 tiles. Any mix of pungs and chows works. That's it — that's the whole game.</>,
      groups: [
        { label: "Chow", tiles: [D(1), D(2), D(3)] },
        { label: "Pung", tiles: [B(5), B(5), B(5)] },
        { label: "Chow", tiles: [Ch(7), Ch(8), Ch(9)] },
        { label: "Pung", tiles: [W("東"), W("東"), W("東")] },
        { label: "Pair", tiles: [Dr("r"), Dr("r")] },
      ],
    },
    {
      type: "judge", prompt: "Is this hand a winner?",
      groups: [
        { tiles: [D(2), D(3), D(4)] },
        { tiles: [B(1), B(1), B(1)] },
        { tiles: [Ch(5), Ch(6), Ch(7)] },
        { tiles: [Dr("g"), Dr("g"), Dr("g")] },
        { tiles: [W("西"), W("西")] },
      ],
      choices: ["食糊 — it's a win!", "Not yet"], correct: 0,
      hint: "Count: chow, pung, chow, pung… and a pair of Wests.",
    },
    {
      type: "judge", prompt: "How about this one?",
      groups: [
        { tiles: [D(2), D(3), D(4)] },
        { tiles: [B(1), B(1), B(1)] },
        { tiles: [Ch(5), Ch(6), Ch(7)] },
        { tiles: [Dr("g"), Dr("g"), Dr("g")] },
        { tiles: [Dr("r")] },
      ],
      choices: ["食糊 — it's a win!", "Not yet"], correct: 1,
      hint: "Four sets, but the red dragon is all alone. No pair, no win.",
    },
    {
      type: "pickOne", prompt: "One tile from glory — complete the pair",
      context: [Dr("w"), "gap"],
      tiles: [Dr("w"), Dr("r"), W("北")], correct: 0,
      hint: "The blank frame needs its twin.",
    },
    {
      type: "judge", prompt: "You're about to shout 食糊. Count first — is it really a win?",
      say: () => <>A false win — <b>詐糊 zaa wu</b> — is the most mortifying foul at the table, and it carries a penalty. So before you ever shout: <b>count 4 sets + a pair.</b> Every time.</>,
      groups: [
        { tiles: [B(3), B(4), B(5)] },
        { tiles: [D(9), D(9), D(9)] },
        { tiles: [Ch(1), Ch(2), Ch(3)] },
        { tiles: [W("南"), W("南"), W("南")] },
        { tiles: [Ch(6), Ch(7)] },
      ],
      choices: ["食糊 — I'm sure!", "Wait… not yet"], correct: 1,
      hint: "6-7 of Characters is an unfinished chow, not a pair. Shout this and it's 詐糊. Always count twice.",
    },
    {
      type: "teach", title: "Who pays the winner?",
      say: () => <>This is why mahjong has stakes. If you win off someone's <b>discard</b> (出銃 ceot cung), <b>that one player pays</b> — which is why a careless discard is dangerous. If you <b>self-draw</b> the winning tile (自摸 zi mo), <b>everyone pays.</b></>,
      groups: [
        { label: "出銃 · discarder pays", tiles: [D(5), D(5), D(5)] },
        { label: "自摸 · everyone pays", tiles: [Dr("g"), Dr("g"), Dr("g")] },
      ],
      note: "Feed the winner their tile and your wallet feels it. Hence: defense.",
    },
    {
      type: "teach", title: "Shout it: 食糊!",
      say: () => <>When the 14th tile truly completes your hand, you call <b>sik wu 食糊</b> — literally “eat the hand” — and lay your tiles face-up. You've counted twice, so shout with confidence. Modesty is not traditional.</>,
      tiles: [Dr("r")], requireAll: false, note: "Next: how a turn actually works.",
    },
  ],
  5: [
    {
      type: "teach", title: "The rhythm of a turn",
      say: () => <>You live at <b>13 tiles</b>. On your turn: <b>draw</b> one (now 14), pick your least useful tile, <b>discard</b> it face-up (back to 13). Repeat around the table until someone wins. That's the entire engine.</>,
      tiles: [], requireAll: false, visual: "flow", note: "Draw → choose → discard. Always.",
    },
    {
      type: "pickOne", prompt: "You hold 13 tiles and it's your turn. After drawing, how many are in your hand?",
      choices: ["13", "14", "15"], correct: 1,
      hint: "Draw first, discard after — 13 + 1.",
    },
    {
      type: "teach", title: "What do I throw away?",
      say: () => <>Early-game rule of thumb: <b>lonely tiles go first</b>. A tile is lonely if it has no twin and no neighbours — it can't grow into a pung or a chow.</>,
      tiles: [W("北")], captions: ["A lone North wind: very lonely"], requireAll: false,
    },
    {
      type: "pickOne", prompt: "Your hand. Tap the best discard.",
      tiles: [Ch(3), Ch(4), D(7), D(7), W("北")], correct: 4,
      hint: "3-4 wants a chow, the 7s want a pung. The lone wind wants nothing.",
    },
    {
      type: "pickOne", prompt: "One more. Tap the best discard.",
      tiles: [B(2), B(3), B(4), D(5), D(5), Ch(9)], correct: 5,
      hint: "The chow is finished, the pair has hope — the lone 9 has neither.",
    },
    {
      type: "teach", title: "Your discards tell a story",
      say: () => <>Discards pile face-up in the middle — the <b>pond</b>. Sharp players read it like tea leaves: throw four Bamboo tiles in a row and everyone knows what you're <i>not</i> collecting.</>,
      tiles: [], requireAll: false, visual: "pond", note: "Mind what you feed the pond.",
    },
  ],
  6: [
    {
      type: "teach", title: "Interrupting, politely",
      say: () => <>Mahjong lets you <b>claim other players' discards</b> — if you call fast enough. Three calls: <b>碰 Pung</b> (their discard + your two identical, from <i>anyone</i>), <b>上 Sheung</b> (a chow — but only from the player on your <i>left</i>), and <b>食 Sik wu</b> (the win — from anyone).</>,
      tiles: [D(5), D(5)], captions: ["You hold", "this pair"], requireAll: false,
    },
    {
      type: "pickOne", prompt: "The player ACROSS the table discards this. You hold two of them. Your call?",
      tiles: [D(5)], big: true, stack: true,
      choices: ["碰 Pung!", "上 Sheung", "Pass"], correct: 0,
      hint: "Pung works on anyone's discard.",
    },
    {
      type: "pickOne", prompt: "Your LEFT neighbour discards this. You hold the 2 and 3 of Characters.",
      tiles: [Ch(4)], big: true, stack: true,
      choices: ["上 Sheung!", "碰 Pung", "Pass"], correct: 0,
      hint: "2-3 + their 4 = a chow, and it came from your left. Perfect.",
    },
    {
      type: "pickOne", prompt: "Same hand — but now the player ACROSS discards it.",
      tiles: [Ch(4)], big: true, stack: true,
      choices: ["上 Sheung", "Pass 😤", "碰 Pung"], correct: 1,
      hint: "A chow can only ever come from your left. Rules are rules.",
    },
    {
      type: "teach", title: "Who wins the shouting match?",
      say: () => <>If two players call the same tile: <b>食 Win</b> beats <b>碰 Pung</b> beats <b>上 Sheung</b>. The win always eats first.</>,
      tiles: [], requireAll: false, visual: "priority", note: "食 > 碰 > 上",
    },
    {
      type: "pickOne", prompt: "You're one 9 of Bamboo from winning. An opponent discards it. Your call?",
      tiles: [B(9)], big: true, stack: true,
      choices: ["食 SIK WU!!", "碰 Pung", "Politely pass"], correct: 0,
      hint: "Never pass on the win. Grandma wouldn't.",
    },
    {
      type: "speed", prompt: "Lightning round!",
      say: () => <>At a real table, a call window is about <b>two seconds</b>. Here comes a discard — you hold two of them. Tap before the timer runs out.</>,
      tile: D(7), seconds: 4,
      choices: ["碰 Pung!", "上 Sheung", "Pass"], correct: 0,
      hint: "Pung — and quick! Hesitate at a real table and the tile is gone.",
    },
    {
      type: "speed", prompt: "Again — faster!",
      say: () => <>You're one <b>9 of Bamboo</b> from winning and an opponent throws it. Don't think — react.</>,
      tile: B(9), seconds: 3,
      choices: ["食 SIK WU!", "碰 Pung", "Pass"], correct: 0,
      hint: "The win. Always the win. Speed is the whole point here.",
    },
    {
      type: "teach", title: "You know the whole loop",
      say: (t) => <>Tiles, sets, the winning shape, turns, calls — that's a <b>complete game</b> of Hong Kong mahjong. What's left is scoring (<b>fan 番</b>) and strategy — where the real fun, and your relatives' pocket money, lives. On to Unit 2.</>,
      groups: [
        { label: "Chow", tiles: [D(1), D(2), D(3)] },
        { label: "Pung", tiles: [B(5), B(5), B(5)] },
        { label: "Chow", tiles: [Ch(7), Ch(8), Ch(9)] },
        { label: "Pung", tiles: [W("東"), W("東"), W("東")] },
        { label: "Pair", tiles: [Dr("r"), Dr("r")] },
      ],
      requireAll: false, note: "A complete winning hand — and you can read every tile in it now.",
    },
  ],
  7: [
    {
      type: "teach", title: "Scoring lives in “fan” 番",
      say: () => <>You can win… and still win <i>nothing</i>. A hand's value is counted in <b>fan 番 (faan)</b> — points you earn from special tiles and patterns. More fan = more money. This unit teaches you where fan comes from.</>,
      tiles: [Dr("r")], requireAll: false, note: "Think of fan as the “score multiplier” on your win.",
    },
    {
      type: "teach", title: "The 3-fan minimum",
      say: () => <>Most HK tables set a <b>minimum to win</b> — commonly <b>3 fan</b>. A hand worth fewer can't be declared; you keep playing for something bigger. This rule is why people chase patterns instead of just completing any 14 tiles.</>,
      groups: [{ label: "Needs ≥ 3 fan to declare", tiles: [Dr("g"), Dr("g"), Dr("g")] }],
      note: "House rules vary — but “a cheap hand can't win” is near-universal.",
    },
    {
      type: "pickOne", prompt: "A pung of Red Dragon is worth fan. True or false?",
      choices: ["True — dragons score", "False — no tile scores"], correct: 0,
      hint: "Any dragon triplet always gives fan. Dragons are money tiles.",
    },
    {
      type: "teach", title: "Where fan comes from",
      say: () => <>Common fan sources you'll learn this unit: <b>dragon pungs</b>, <b>your seat wind</b>, <b>all one suit</b>, <b>all pungs</b>, and <b>self-draw</b>. Each adds fan; stack several and a hand gets expensive — in your favour.</>,
      groups: [
        { label: "Dragon pung", tiles: [Dr("r"), Dr("r"), Dr("r")] },
        { label: "Your seat wind", tiles: [W("南"), W("南"), W("南")] },
        { label: "All one suit", tiles: [D(2), D(3), D(4)] },
      ], requireAll: false, note: "Fan stacks. One big hand can be worth many small ones.",
    },
    {
      type: "pickOne", prompt: "Your table's minimum is 3 fan. Your hand is worth 1 fan. Can you declare a win?",
      choices: ["Yes, a win's a win", "No — keep building"], correct: 1,
      hint: "Below the minimum, you can't declare. Hold out for more fan.",
    },
  ],
  8: [
    {
      type: "teach", title: "The money hands",
      say: () => <>Some shapes are worth chasing because they pay big. The first: <b>All Pungs 對對糊 (deui deui wu)</b> — every set is a triplet (or kong), <b>no chows</b>, plus your pair.</>,
      groups: [
        { label: "pung", tiles: [D(3), D(3), D(3)] },
        { label: "pung", tiles: [B(7), B(7), B(7)] },
        { label: "pung", tiles: [Ch(2), Ch(2), Ch(2)] },
        { label: "pung", tiles: [W("東"), W("東"), W("東")] },
        { label: "pair", tiles: [Dr("r"), Dr("r")] },
      ],
    },
    {
      type: "judge", prompt: "Is this an All-Pungs hand?",
      groups: [
        { tiles: [D(5), D(5), D(5)] },
        { tiles: [B(2), B(3), B(4)] },
        { tiles: [Ch(8), Ch(8), Ch(8)] },
        { tiles: [W("南"), W("南"), W("南")] },
        { tiles: [Dr("g"), Dr("g")] },
      ],
      choices: ["Yes — all pungs", "No — there's a chow"], correct: 1,
      hint: "2-3-4 of Bamboo is a chow. All Pungs allows zero chows.",
    },
    {
      type: "teach", title: "One-suit hands",
      say: () => <><b>Mixed One Suit 混一色</b> = one suit + honor tiles only. <b>Pure One Suit 清一色</b> = a single suit, <b>nothing else</b> — no honors. Pure is rarer and pays a lot more.</>,
      groups: [
        { label: "混一色 (suit + honors)", tiles: [B(2), B(3), B(4)] },
        { label: "清一色 (one suit only)", tiles: [D(1), D(2), D(3)] },
      ],
    },
    {
      type: "judge", prompt: "Is this Pure One Suit 清一色?",
      groups: [
        { tiles: [D(1), D(2), D(3)] },
        { tiles: [D(4), D(5), D(6)] },
        { tiles: [D(7), D(8), D(9)] },
        { tiles: [D(2), D(2), D(2)] },
        { tiles: [D(5), D(5)] },
      ],
      choices: ["Yes — all Dots, no honors", "No"], correct: 0,
      hint: "Every tile is a Dot, with no winds or dragons. That's pure.",
    },
    {
      type: "judge", prompt: "And this one — Pure One Suit?",
      groups: [
        { tiles: [B(1), B(2), B(3)] },
        { tiles: [B(5), B(5), B(5)] },
        { tiles: [B(7), B(8), B(9)] },
        { tiles: [Dr("r"), Dr("r"), Dr("r")] },
        { tiles: [B(4), B(4)] },
      ],
      choices: ["Yes", "No — a dragon sneaks in"], correct: 1,
      hint: "The red dragon makes it Mixed (混一色), not Pure. Pure means zero honors.",
    },
  ],
  9: [
    {
      type: "teach", title: "Your seat has a wind",
      say: () => <>Each of the four seats <i>is</i> a wind: <b>East 東, South 南, West 西, North 北</b>, going counter-clockwise. East is the <b>dealer (莊 zong)</b>. Your seat wind is special — to <i>you</i>.</>,
      tiles: [W("東"), W("南"), W("西"), W("北")],
      captions: ["East (dealer)", "South", "West", "North"], requireAll: true,
    },
    {
      type: "teach", title: "Why your wind pays",
      say: () => <>A pung of <b>your own seat wind</b> scores fan. So does a pung of the <b>prevailing wind</b> (the wind of the current round). Get a wind that's <i>both</i> and it's a double. Other winds? Just tiles.</>,
      groups: [{ label: "If you're South: this pays", tiles: [W("南"), W("南"), W("南")] }],
      note: "Seat wind + round wind are the two “lucky” winds for you.",
    },
    {
      type: "pickOne", prompt: "You're in the South seat with a pung of South 南. Does it score fan?",
      choices: ["Yes — it's your seat wind", "No — winds never score"], correct: 0,
      hint: "Your own seat wind always pays. 南 is yours.",
    },
    {
      type: "pickOne", prompt: "You're South. You have a pung of West 西. The round wind is East. Bonus fan?",
      tiles: [W("西")], big: true, stack: true,
      choices: ["Yes", "No — not your wind, not the round's"], correct: 1,
      hint: "West isn't your seat wind and isn't the prevailing wind. No bonus.",
    },
    {
      type: "teach", title: "The dealer's stakes",
      say: () => <>The <b>dealer (East)</b> plays for double — wins double, pays double. Win as dealer and you <b>stay dealer</b> and go again. The seat rotates only when the dealer loses the hand. High risk, high reward.</>,
      tiles: [], requireAll: false, visual: "dealer", note: "Dealing is a hot seat — literally worth twice as much.",
    },
  ],
  10: [
    {
      type: "teach", title: "Self-draw 自摸",
      say: () => <>How you get your final tile matters. Draw it yourself from the wall — <b>自摸 zi mo (self-draw)</b> — and it's worth <b>extra fan</b>, and <b>everyone</b> pays. Win off a discard and only the discarder pays.</>,
      groups: [
        { label: "自摸 · drew it myself · all pay", tiles: [Dr("g"), Dr("g"), Dr("g")] },
      ],
      note: "Self-draw = more fan + everyone chips in. Best way to win.",
    },
    {
      type: "pickOne", prompt: "You self-draw 自摸 your winning tile. Who pays you?",
      choices: ["Everyone at the table", "Only the player before me"], correct: 0,
      hint: "Self-draw means all three opponents pay. That's the bonus.",
    },
    {
      type: "teach", title: "Kong 槓 — the fourth tile",
      say: () => <>Three identical tiles is a pung. A <b>fourth</b> makes a <b>Kong 槓</b>. Declare it, and because a kong “uses up” a tile, you <b>draw a replacement</b> — and pocket a little bonus. Kongs are the only set with four tiles.</>,
      groups: [
        { label: "Pung · 3", tiles: [Ch(5), Ch(5), Ch(5)] },
        { label: "Kong 槓 · 4", tiles: [Ch(5), Ch(5), Ch(5), Ch(5)] },
      ],
    },
    {
      type: "pickSet", prompt: "Tap the Kong",
      options: [
        { tiles: [D(2), D(2), D(2)] },
        { tiles: [B(9), B(9), B(9), B(9)] },
        { tiles: [W("北"), W("北")] },
      ],
      correct: 1, hint: "Four identical tiles = a kong. Three is only a pung.",
    },
    {
      type: "teach", title: "Lucky wins",
      say: () => <>A few wins carry their own fan just for <i>how</i> they happen: winning on the <b>very last tile</b>, winning on your <b>replacement draw</b> after a kong, or <b>robbing a kong</b> (winning on the tile someone adds to a pung). Rare, delightful, and bragged about for years.</>,
      groups: [
        { label: "Last tile in the wall", tiles: [D(5)] },
        { label: "After a kong", tiles: [B(3), B(3), B(3), B(3)] },
        { label: "Robbing a kong", tiles: [Dr("g")] },
      ], requireAll: false, note: "The game rewards drama. So will your family.",
    },
  ],
  11: [
    {
      type: "teach", title: "Defense saves more than offense",
      say: () => <>Here's the lesson that protects your wallet. If you discard the exact tile an opponent needs, <b>you alone pay</b> — that's <b>出銃 ceot cung</b> (“firing the gun”). When someone looks close to winning, stop pushing and play <b>safe</b>.</>,
      tiles: [], requireAll: false, visual: "fire", note: "A reckless discard can cost you the whole hand's payout.",
    },
    {
      type: "teach", title: "Read the pond",
      say: () => <>The safest tile to throw is one <b>already sitting in the pond</b> — if nobody claimed it before, nobody can win on it now. Watch what a fast player discards: they're telling you what they <i>don't</i> need.</>,
      groups: [{ label: "Already discarded = safer to repeat", tiles: [B(1), B(1)] }],
      note: "“It didn't win last time” is a mahjong player's safety net.",
    },
    {
      type: "pickOne", prompt: "An opponent looks one tile from winning. The 9 of Dots is already in the pond, untouched. Safest discard?",
      tiles: [D(9), Ch(3), B(5)], correct: 0,
      hint: "A tile already discarded and not claimed can't be a winning wait. Repeat it.",
    },
    {
      type: "teach", title: "When to fold",
      say: () => <>If your hand is far from winning and someone's clearly close, <b>give up the hand</b> — discard only safe tiles and deny them. Losing a few points beats paying a big hand. Good players lose <i>small</i>.</>,
      groups: [
        { label: "Safe — already in the pond", tiles: [B(1)] },
        { label: "Safe — a seen honor", tiles: [W("北")] },
      ], requireAll: false, note: "You can't win every hand. You can avoid paying for the worst ones.",
    },
    {
      type: "pickOne", prompt: "Your hand is a mess and South is about to win. What's the right play?",
      choices: ["Discard only safe tiles & defend", "Chase my own long-shot win"], correct: 0,
      hint: "Far from winning + opponent close = defend. Lose small.",
    },
  ],
  12: [
    {
      type: "teach", title: "Setting the table 開枱",
      say: () => <>Time for the real thing. Everyone <b>washes the tiles</b> face-down — that shuffling clatter is the “sparrow chatter” the game is named for — then each player <b>builds a wall</b> of stacked tiles in front of them.</>,
      tiles: [], requireAll: false, visual: "wall", note: "洗牌 (wash) → build four walls → you've made the square.",
    },
    {
      type: "teach", title: "Dice & the deal",
      say: () => <>The dealer <b>rolls dice</b> to pick where to break the wall — keeping it fair and unpredictable. Then tiles are dealt around until everyone holds <b>13</b> (the dealer takes the first turn with 14). Now you play the loop you already know.</>,
      tiles: [], requireAll: false, visual: "dice", note: "Dice decide the break point. 13 tiles each. Go.",
    },
    {
      type: "pickOne", prompt: "How many tiles does each player hold to start (before drawing)?",
      choices: ["13", "14", "16"], correct: 0,
      hint: "Thirteen each; the dealer draws into 14 to take the first turn.",
    },
    {
      type: "teach", title: "Table manners",
      say: () => <>Etiquette keeps the peace: discard <b>tidily into the pond</b>, <b>announce your calls clearly</b> (碰! 食糊!), never reach into someone else's tiles, and <b>settle up promptly</b>. Slow, sloppy, or silent play is how you become the relative nobody invites.</>,
      tiles: [], requireAll: false, visual: "manners", note: "Clear calls, neat pond, quick payment. That's a welcome guest.",
    },
    {
      type: "teach", title: "You're table-ready 🎉",
      say: (t) => <>Tiles, sets, the winning shape, turns, calls, scoring, defense, and the rituals — <b>you know how to play Hong Kong mahjong.</b> Sit down with confidence. Next stop: a full game against our bots in <b>Simulation mode</b> — coming soon to put it all together.</>,
      tiles: [Dr("r")], requireAll: false,
    },
  ],
};

const LESSONS = [
  { id: 1, name: "Meet the Tiles", cn: "認牌", sub: "The three suits", color: "#E2231A", Icon: IconTile, unit: 1 },
  { id: 2, name: "Winds & Dragons", cn: "風與龍", sub: "The honor tiles", color: "#0860A8", Icon: IconDragon, unit: 1 },
  { id: 3, name: "Building Sets", cn: "砌組合", sub: "Pung · Chow · Pair", color: "#00A862", Icon: IconSteamer, unit: 1 },
  { id: 4, name: "The Winning Hand", cn: "食糊", sub: "4 sets + a pair", color: "#7D499D", Icon: IconNeonWin, unit: 1 },
  { id: 5, name: "Your First Turn", cn: "打牌", sub: "Draw & discard", color: "#F7943E", Icon: IconTaxi, unit: 1 },
  { id: 6, name: "Calling Tiles", cn: "叫牌", sub: "Pung! Sik wu!", color: "#9C5B25", Icon: IconPung, unit: 1 },
  { id: 7, name: "What's a Fan?", cn: "番數", sub: "How scoring works", color: "#B8860B", Icon: IconFan, unit: 2 },
  { id: 8, name: "The Money Hands", cn: "大牌", sub: "Patterns worth chasing", color: "#C0392B", Icon: IconMoneyHand, unit: 2 },
  { id: 9, name: "Your Seat, Your Wind", cn: "門風", sub: "Seat & round winds", color: "#2E86C1", Icon: IconSeat, unit: 2 },
  { id: 10, name: "Self-Draw & Kong", cn: "自摸槓", sub: "Zi mo & the 4th tile", color: "#16A085", Icon: IconKong, unit: 2 },
  { id: 11, name: "Defense", cn: "出銃", sub: "Don't feed the winner", color: "#7D3C98", Icon: IconShield, unit: 2 },
  { id: 12, name: "At the Table", cn: "開枱", sub: "Rituals & graduation", color: "#D35400", Icon: IconTrophy, unit: 2 },
];

const COMPLETE_COPY = {
  1: "You can now tell every suit apart — the part that makes beginners freeze. Next stop: the honor tiles.",
  2: "Winds, dragons, and flowers — you now recognize every tile in the set. Next: snapping tiles into sets.",
  3: "Pair, pung, chow — you speak mahjong's entire vocabulary now. Time to assemble a winning hand.",
  4: "You know the winning shape: 4 sets + a pair. From here on, every tile is either helping or in the way.",
  5: "Draw, judge, discard — you could sit at a table right now and hold your own. Next: interrupting everyone else.",
  6: "That's the full game loop — you know how to play. Now Unit 2 turns you from “can play” into “can win.”",
  7: "Fan, demystified — you get how a win earns its value, and why cheap hands don't count. Next: the big-money patterns.",
  8: "All Pungs, one-suit hands — you now know the shapes worth chasing for real points. Next: the winds that pay you.",
  9: "Seat wind, round wind, the dealer's double — you can spot the winds that quietly add up. Next: self-draw & kong.",
  10: "Self-draw, kong, and the lucky wins — your scoring toolkit is complete. Next: the skill that saves your wallet.",
  11: "Defense — the difference between losing small and losing big. One lesson left: sitting down for real.",
  12: "That's the whole game — rules, scoring, strategy, and table manners. You're officially table-ready. 🀄",
};

const UNIT_META = {
  2: { name: "Unit 2 · Scoring & Strategy", cn: "番數同戰術" },
};

/* ---------------- CONFETTI ---------------- */

function Confetti() {
  const T = useT();
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 2.4 + Math.random() * 1.6,
        size: 7 + Math.random() * 9,
        color: [T.primary, T.star, T.neonPink, "#7FB8E8", "#FFB3C7"][i % 5],
        round: Math.random() > 0.5,
      })),
    [T]
  );
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((p, i) => (
        <span key={i} className="ss-confetti"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * (p.round ? 1 : 0.55), background: p.color, borderRadius: p.round ? "50%" : 3, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
}

/* ---------------- SCREENS ---------------- */

function Wordmark({ onClick, light = false }) {
  const T = useT();
  return (
    <button onClick={onClick}
      style={{ background: "none", border: "none", padding: 0, cursor: onClick ? "pointer" : "default", fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 25, color: light ? "#fff" : T.ink, letterSpacing: T.displaySpacing, WebkitTapHighlightColor: "transparent", display: "inline-flex", alignItems: "center", gap: 7 }}
      aria-label="Mahjong Auntie home">
      <span>mahjong<span style={{ color: T.neonPink, textShadow: T.neon ? `0 0 9px ${T.neonPink}80, 0 0 22px ${T.neonPink}40` : "none" }}>auntie</span></span>
    </button>
  );
}

function Header({ stars, onSettings, onLogo }) {
  const T = useT();
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 2px 8px" }}>
      <Wordmark onClick={onLogo} />
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 999, padding: "9px 15px", fontWeight: 800, fontSize: 16, color: T.ink, boxShadow: T.chipShadow, backdropFilter: T.glass ? "blur(18px)" : undefined }}>
          <span style={{ color: T.star }}>★</span> {stars}
        </div>
        <button onClick={onSettings} aria-label="Settings"
          style={{ width: 46, height: 46, borderRadius: 999, background: T.card, border: `1.5px solid ${T.cardBorder}`, boxShadow: T.chipShadow, cursor: "pointer", fontSize: 20, color: T.sub, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: T.glass ? "blur(18px)" : undefined, WebkitTapHighlightColor: "transparent" }}>
          ⚙︎
        </button>
      </div>
    </header>
  );
}

function StationDot({ done, active, color }) {
  return (
    <div className={active ? "ss-beat" : ""} style={{
      width: 30, height: 30, borderRadius: "50%", flexShrink: 0, zIndex: 1,
      background: done ? color : "#FFFFFF",
      border: `4px solid ${MTR_INK}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: 14, fontWeight: 800,
      boxShadow: active ? `0 0 0 6px ${color}33` : "0 1px 2px rgba(0,0,0,.12)",
    }}>{done ? "✓" : ""}</div>
  );
}

function Home({ stars, completed, teacher, onStart, onSettings, onLogo, onSim, onMemory, onWin, onPractice }) {
  const T = useT();
  const A = teacher.Comp;
  return (
    <div style={{ padding: "0 18px 30px" }}>
      <Header stars={stars} onSettings={onSettings} onLogo={onLogo} />

      <CardBox style={{ overflow: "hidden", margin: "10px 0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px 10px" }}>
          <A size={66} />
          <div>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 19, color: T.ink, lineHeight: 1.3, letterSpacing: T.displaySpacing }}>
              Learn mahjong before you ever sit down.
            </div>
            <div style={{ fontSize: 14.5, color: T.sub, marginTop: 3 }}>Hong Kong style · 5 min a day</div>
          </div>
        </div>
        <HarborScene height={62} />
      </CardBox>

      {/* MTR route header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: MTR_INK, borderRadius: 13, padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 3 }}>
          {LESSONS.map((l) => (
            <span key={l.id} style={{ width: 9, height: 9, borderRadius: 2.5, background: completed.includes(l.id) ? l.color : "#5A6068" }} />
          ))}
        </div>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 15.5, fontFamily: T.fontDisplay, letterSpacing: ".01em" }}>Auntie Line</span>
        <span style={{ color: "#B9C0C9", fontWeight: 700, fontSize: 14, fontFamily: "'Noto Sans TC',sans-serif" }}>雀線</span>
        <span style={{ marginLeft: "auto", color: "#B9C0C9", fontWeight: 800, fontSize: 12.5 }}>{completed.length}/{LESSONS.length}</span>
      </div>

      {/* MTR-diagram lesson path */}
      <div>
        {LESSONS.map((l, i) => {
          const done = completed.includes(l.id);
          const unlocked = l.id === 1 || completed.includes(l.id - 1);
          const prevDone = i === 0 ? true : completed.includes(LESSONS[i - 1].id);
          const unitStart = i > 0 && l.unit !== LESSONS[i - 1].unit;
          return (
            <React.Fragment key={l.id}>
              {unitStart && UNIT_META[l.unit] && (
                <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ width: 10, minHeight: 18, background: prevDone ? LESSONS[i - 1].color : T.barTrack }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: MTR_INK, borderRadius: 11, padding: "9px 14px", margin: "6px 0 2px" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 14.5, fontFamily: T.fontDisplay }}>{UNIT_META[l.unit].name}</span>
                    <span style={{ color: "#B9C0C9", fontWeight: 700, fontSize: 13, fontFamily: "'Noto Sans TC',sans-serif", marginLeft: "auto" }}>{UNIT_META[l.unit].cn}</span>
                  </div>
                </div>
              )}
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 10, flex: 1, minHeight: 12, background: i === 0 ? "transparent" : prevDone ? LESSONS[i - 1].color : T.barTrack }} />
                <StationDot done={done} active={unlocked && !done} color={l.color} />
                <div style={{ width: 10, flex: 1, minHeight: 12, background: done ? l.color : T.barTrack }} />
              </div>

              <button
                onClick={unlocked ? () => onStart(l.id) : undefined}
                className={`ss-btn ${unlocked && !done ? "ss-glow" : ""}`}
                style={{
                  display: "flex", alignItems: "center", gap: 14, textAlign: "left", width: "100%",
                  background: done ? T.successSoft : unlocked ? T.card : T.locked,
                  border: `1.5px solid ${done ? T.success : unlocked ? T.cardBorder : "rgba(0,0,0,.05)"}`,
                  borderRadius: T.radius, padding: "15px 16px", minHeight: 86, margin: "5px 0",
                  boxShadow: T.btnEdge
                    ? `0 4px 0 ${done ? T.successDeep + "44" : unlocked ? T.cardBorder : T.lockedEdge}`
                    : unlocked ? T.cardShadow : "none",
                  cursor: unlocked ? "pointer" : "default",
                  fontFamily: T.fontBody,
                  backdropFilter: T.glass && unlocked && !done ? "blur(18px)" : undefined,
                  transition: "transform .12s ease",
                  WebkitTapHighlightColor: "transparent",
                  opacity: !unlocked && !done ? 0.8 : 1,
                }}
              >
                <div style={{
                  width: 54, height: 54, borderRadius: 15, flexShrink: 0,
                  background: `${l.color}${unlocked || done ? "1C" : "10"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  filter: unlocked || done ? "none" : "grayscale(.9) opacity(.55)",
                }}>
                  <l.Icon />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 17.5, color: unlocked || done ? T.ink : "#A6A29A", fontFamily: T.fontDisplay, letterSpacing: T.displaySpacing }}>{l.name}</div>
                  <div style={{ fontSize: 14, color: unlocked || done ? T.sub : "#B5B1A8", marginTop: 2 }}>
                    <span style={{ fontFamily: "'Noto Sans TC',sans-serif", fontWeight: 700, color: unlocked || done ? l.color : "#B5B1A8" }}>{l.cn}</span>
                    {" · "}{l.sub}
                  </div>
                </div>
                {done && <span style={{ color: T.success, fontSize: 18, fontWeight: 800 }}>✓</span>}
                {unlocked && !done && <span style={{ color: l.color, fontSize: 21, fontWeight: 800 }}>›</span>}
                {!unlocked && !done && <span style={{ fontSize: 15 }}>🔒</span>}
              </button>
            </div>
            </React.Fragment>
          );
        })}

        {/* line extension: Simulation — now playable */}
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 0, flex: 1, minHeight: 16, borderLeft: `4px dashed #D35400` }} />
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", border: `4px solid #D35400` }} />
          </div>
          <button onClick={onSim} className="ss-btn ss-glow" style={{
            border: `1.5px solid #D35400`, borderRadius: T.radius, background: "#FFF1E6",
            padding: "14px 16px", margin: "8px 0 4px", minHeight: 78, width: "100%", textAlign: "left",
            display: "flex", alignItems: "center", gap: 13, cursor: "pointer",
            boxShadow: T.btnEdge ? "0 4px 0 #E8C5A8" : T.cardShadow, fontFamily: T.fontBody,
            WebkitTapHighlightColor: "transparent",
          }}>
            <div style={{ width: 50, height: 50, borderRadius: 13, flexShrink: 0, background: "#D3540022", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🀄</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.ink, fontFamily: T.fontDisplay }}>Play a full game</div>
              <div style={{ fontSize: 13, color: T.sub, marginTop: 1 }}>
                <span style={{ fontFamily: "'Noto Sans TC',sans-serif", fontWeight: 700, color: "#D35400" }}>對戰</span> · a real hand vs. three bots
              </div>
            </div>
            <span style={{ color: "#D35400", fontSize: 21, fontWeight: 800 }}>›</span>
          </button>
        </div>

        {/* Practice & Play hub */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 11 }}>Practice & Play</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
            <button onClick={onMemory} className="ss-btn" style={{ textAlign: "left", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: T.radius, padding: "14px 14px", minHeight: 92, boxShadow: T.btnEdge ? `0 4px 0 ${T.cardBorder}` : T.cardShadow, cursor: "pointer", fontFamily: T.fontBody, WebkitTapHighlightColor: "transparent" }}>
              <div style={{ fontSize: 26 }}>🧠</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: T.ink, marginTop: 7, fontFamily: T.fontDisplay }}>Memory Match</div>
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>Train tile recognition</div>
            </button>
            <button onClick={onWin} className="ss-btn" style={{ textAlign: "left", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: T.radius, padding: "14px 14px", minHeight: 92, boxShadow: T.btnEdge ? `0 4px 0 ${T.cardBorder}` : T.cardShadow, cursor: "pointer", fontFamily: T.fontBody, WebkitTapHighlightColor: "transparent" }}>
              <div style={{ fontSize: 26 }}>🏆</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: T.ink, marginTop: 7, fontFamily: T.fontDisplay }}>How to Win</div>
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>Sets, eyes & scoring</div>
            </button>
          </div>
          <button onClick={onPractice} className="ss-btn ss-glow" style={{ display: "flex", alignItems: "center", gap: 13, textAlign: "left", width: "100%", marginTop: 11, background: T.primarySoft || T.successSoft, border: `1.5px solid ${T.primary}`, borderRadius: T.radius, padding: "15px 16px", minHeight: 74, boxShadow: T.btnEdge ? `0 4px 0 ${T.primaryDeep}55` : T.cardShadow, cursor: "pointer", fontFamily: T.fontBody, WebkitTapHighlightColor: "transparent" }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>♾️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.ink, fontFamily: T.fontDisplay }}>Endless Practice</div>
              <div style={{ fontSize: 13, color: T.sub, marginTop: 1 }}>Freshly-generated drills — never the same twice</div>
            </div>
            <span style={{ color: T.primary, fontSize: 21, fontWeight: 800 }}>›</span>
          </button>
          <div style={{ fontSize: 12, color: T.sub, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
            Tip: tap any finished lesson to replay and practice it again.
          </div>
        </div>
      </div>
    </div>
  );
}

function SetRowOption({ tiles, state, onTap }) {
  const T = useT();
  return (
    <button
      onClick={() => { clack(); onTap(); }}
      className={`ss-btn ss-deal ${state === "wrong" ? "ss-shake" : ""} ${state === "correct" ? "ss-pop" : ""}`}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        width: "100%", padding: "13px 14px",
        background: state === "correct" ? T.successSoft : state === "wrong" ? T.dangerSoft : T.card,
        border: `2px solid ${state === "correct" ? T.success : state === "wrong" ? T.danger : T.cardBorder}`,
        borderRadius: 18,
        boxShadow: T.btnEdge ? `0 4px 0 ${state === "correct" ? T.successDeep + "55" : T.cardBorder}` : T.cardShadow,
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        transition: "background .15s ease, border-color .15s ease",
      }}
    >
      {tiles.map((t, i) => <MiniTile key={i} t={t} size={56} />)}
    </button>
  );
}

function GroupsDisplay({ groups, mini = 42, labeled = false }) {
  const T = useT();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "14px 16px" }}>
      {groups.map((g, i) => (
        <div key={i} className="ss-deal" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, animationDelay: `${i * 70}ms` }}>
          <div style={{ display: "flex", gap: 3, padding: "7px 8px", background: "rgba(0,0,0,.035)", borderRadius: 12 }}>
            {g.tiles.map((t, j) => <MiniTile key={j} t={t} size={mini} />)}
          </div>
          {labeled && g.label && <span style={{ fontSize: 13, fontWeight: 800, color: T.sub }}>{g.label}</span>}
        </div>
      ))}
    </div>
  );
}

function ChoiceStack({ choices, choice, wrong, onPick }) {
  const T = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {choices.map((c, i) => (
        <button key={i} onClick={() => { clack(); onPick(i); }}
          className={`ss-btn ${wrong === i ? "ss-shake" : ""}`}
          style={{
            width: "100%", minHeight: 58, fontSize: 17.5, fontWeight: 800, fontFamily: T.fontBody,
            background: choice === i ? T.success : T.card,
            color: choice === i ? "#fff" : T.ink,
            border: `2px solid ${wrong === i ? T.danger : choice === i ? T.success : T.cardBorder}`,
            borderRadius: 16, cursor: "pointer",
            boxShadow: T.btnEdge ? `0 4px 0 ${choice === i ? T.successDeep : T.cardBorder}` : T.cardShadow,
            WebkitTapHighlightColor: "transparent",
            transition: "transform .12s ease, background .15s ease",
          }}>
          {c}
        </button>
      ))}
    </div>
  );
}

function Lesson({ lessonId, teacher, onExit, onComplete, addStars, customSteps }) {
  const T = useT();
  const STEPS = customSteps || LESSON_CONTENT[lessonId];
  const [idx, setIdx] = useState(0);
  const [tapped, setTapped] = useState([]);
  const [picked, setPicked] = useState([]);
  const [wrong, setWrong] = useState(null);
  const [choice, setChoice] = useState(null);
  const [missed, setMissed] = useState(false);
  const [gained, setGained] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const awarded = useRef(new Set());

  const step = STEPS[idx];
  const total = STEPS.length;
  const reset = () => { setTapped([]); setPicked([]); setWrong(null); setChoice(null); setMissed(false); setGained(false); };

  const isMany = step.type === "pickMany" || step.type === "findSet";
  const isDrill = ["pickOne", "pickMany", "pickSet", "judge", "findSet", "speed"].includes(step.type);
  const stepDone =
    step.type === "teach"
      ? !step.requireAll || tapped.length === (step.tiles || []).length
      : step.type === "mnemo"
      ? true
      : isMany
      ? picked.length === step.correct.length
      : choice === step.correct;

  // speed timer
  React.useEffect(() => {
    if (step.type !== "speed") { setTimeLeft(null); return; }
    setTimeLeft(step.seconds);
    const started = Date.now();
    const id = setInterval(() => {
      const left = step.seconds - (Date.now() - started) / 1000;
      if (left <= 0) { setTimeLeft(0); clearInterval(id); }
      else setTimeLeft(left);
    }, 50);
    return () => clearInterval(id);
  }, [idx, step.type, step.seconds]);

  const timeUp = step.type === "speed" && timeLeft === 0 && choice !== step.correct;

  const award = () => {
    if (!awarded.current.has(idx)) {
      awarded.current.add(idx);
      addStars(10);
      setGained(true);
    }
  };

  const next = () => {
    if (idx + 1 >= total) { onComplete(); return; }
    setIdx(idx + 1); reset();
  };
  const back = () => { if (idx > 0) { setIdx(idx - 1); reset(); } };

  const flashWrong = (i) => { setWrong(i); setMissed(true); setTimeout(() => setWrong(null), 450); };
  const tapTeach = (i) => { if (!tapped.includes(i)) setTapped([...tapped, i]); };
  const tapMany = (i) => {
    if (picked.includes(i)) return;
    if (step.correct.includes(i)) {
      const p = [...picked, i];
      setPicked(p);
      if (p.length === step.correct.length) award();
    } else flashWrong(i);
  };
  const tapOne = (i) => {
    if (choice === step.correct) return;
    if (i === step.correct) { setChoice(i); award(); } else flashWrong(i);
  };

  const sheetState = isDrill && stepDone ? "good" : (missed || timeUp) && !stepDone ? "hint" : "idle";

  const promptStyle = { fontFamily: T.fontDisplay, fontSize: 23, fontWeight: 800, color: T.ink, margin: "8px 0 6px", letterSpacing: T.displaySpacing, lineHeight: 1.28 };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "min(100dvh, 800px)" }}>
      {/* header: exit · back · progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 6px" }}>
        <button onClick={onExit} aria-label="Exit lesson"
          style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, width: 46, height: 46, fontSize: 18, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow, WebkitTapHighlightColor: "transparent", flexShrink: 0 }}>✕</button>
        <button onClick={back} disabled={idx === 0} aria-label="Previous step"
          style={{ background: idx === 0 ? T.locked : T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, width: 46, height: 46, fontSize: 21, color: idx === 0 ? "#C2BEB5" : T.sub, cursor: idx === 0 ? "default" : "pointer", boxShadow: T.chipShadow, WebkitTapHighlightColor: "transparent", flexShrink: 0 }}>‹</button>
        <div style={{ flex: 1, height: 18, background: T.barTrack, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${((idx + (stepDone ? 1 : 0)) / total) * 100}%`, height: "100%", background: T.primary, borderRadius: 999, transition: "width .45s cubic-bezier(.34,1.3,.64,1)", boxShadow: T.neon ? `0 0 10px ${T.primary}88` : "none" }} />
        </div>
      </div>

      {/* content */}
      <div key={idx} className="ss-slide" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 18px 8px" }}>

        {step.type === "teach" && (
          <>
            <h2 style={{ ...promptStyle, fontSize: 25, marginBottom: 14 }}>{step.title}</h2>
            <TeacherSays teacher={teacher}>{step.say(teacher)}</TeacherSays>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, paddingTop: 10 }}>
              {step.groups && <GroupsDisplay groups={step.groups} labeled mini={44} />}
              {step.visual && <StepVisual name={step.visual} />}
              {step.tiles && step.tiles.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", gap: step.tiles.length === 4 ? 12 : 18, flexWrap: "wrap" }}>
                  {step.tiles.map((t, i) => (
                    <Tile key={i} t={t} deal={i}
                      size={step.tiles.length === 1 ? 116 : step.tiles.length === 4 ? 78 : 94}
                      state={tapped.includes(i) ? "selected" : "idle"}
                      onTap={() => tapTeach(i)}
                      label={step.captions ? step.captions[i] : undefined} />
                  ))}
                </div>
              )}
              {step.note && <p style={{ textAlign: "center", fontSize: 15.5, color: T.sub, margin: 0, fontWeight: 700 }}>{step.note}</p>}
              {step.requireAll && !stepDone && (
                <p style={{ textAlign: "center", fontSize: 15, color: T.primary, fontWeight: 800, margin: 0 }}>Tap each tile to continue · {tapped.length}/{step.tiles.length}</p>
              )}
            </div>
          </>
        )}

        {step.type === "mnemo" && (
          <>
            <h2 style={{ ...promptStyle, fontSize: 25, marginBottom: 14 }}>{step.title}</h2>
            <TeacherSays teacher={teacher}>{step.say(teacher)}</TeacherSays>
            <div style={{
              flex: 1, display: "grid",
              gridTemplateColumns: `repeat(${step.cards.length === 4 ? 2 : 3}, 1fr)`,
              gap: 10, alignContent: "center", paddingTop: 14,
            }}>
              {step.cards.map((c, i) => (
                <MnemoCard key={i} card={c} tapped={tapped.includes(i)} onTap={() => tapTeach(i)} />
              ))}
            </div>
          </>
        )}

        {step.type === "pickOne" && (
          <>
            <h2 style={promptStyle}>{step.prompt}</h2>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
              {step.context && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 9 }}>
                  {step.context.map((c, i) =>
                    c === "gap" ? <GapTile key={i} size={68} /> : <MiniTile key={i} t={c} size={68} />
                  )}
                </div>
              )}
              {step.big && (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Tile t={step.tiles[0]} size={step.stack ? 108 : 126} deal={0} state={choice === step.correct ? "correct" : "idle"} />
                </div>
              )}
              {step.choices ? (
                step.stack || !step.big ? (
                  step.big || !step.tiles ? (
                    <ChoiceStack choices={step.choices} choice={choice} wrong={wrong} onPick={tapOne} />
                  ) : null
                ) : (
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    {step.choices.map((c, i) => (
                      <button key={i} onClick={() => { clack(); tapOne(i); }}
                        className={`ss-btn ${wrong === i ? "ss-shake" : ""}`}
                        style={{
                          flex: 1, maxWidth: 118, minHeight: 64, fontSize: 20, fontWeight: 800, fontFamily: T.fontDisplay,
                          background: choice === i ? T.success : T.card,
                          color: choice === i ? "#fff" : T.ink,
                          border: `1.5px solid ${wrong === i ? T.danger : choice === i ? T.success : T.cardBorder}`,
                          borderRadius: 18, cursor: "pointer",
                          boxShadow: T.btnEdge ? `0 4px 0 ${choice === i ? T.successDeep : T.cardBorder}` : T.cardShadow,
                          WebkitTapHighlightColor: "transparent",
                          transition: "transform .12s ease",
                        }}>
                        {c}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                  {step.tiles.map((t, i) => (
                    <Tile key={i} t={t} deal={i}
                      size={step.tiles.length > 4 ? 84 : 98}
                      state={choice === i ? "correct" : wrong === i ? "wrong" : "idle"}
                      onTap={() => tapOne(i)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step.type === "pickSet" && (
          <>
            <h2 style={promptStyle}>{step.prompt}</h2>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 13 }}>
              {step.options.map((o, i) => (
                <SetRowOption key={i} tiles={o.tiles}
                  state={choice === i ? "correct" : wrong === i ? "wrong" : "idle"}
                  onTap={() => tapOne(i)} />
              ))}
            </div>
          </>
        )}

        {step.type === "judge" && (
          <>
            <h2 style={promptStyle}>{step.prompt}</h2>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
              <GroupsDisplay groups={step.groups} mini={40} />
              <ChoiceStack choices={step.choices} choice={choice} wrong={wrong} onPick={tapOne} />
            </div>
          </>
        )}

        {(step.type === "pickMany" || step.type === "findSet") && (
          <>
            <h2 style={promptStyle}>{step.prompt}</h2>
            {step.type === "findSet" && step.say && (
              <div style={{ marginBottom: 4 }}><TeacherSays teacher={teacher}>{step.say(teacher)}</TeacherSays></div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", justifyContent: "center", gap: "18px 16px" }}>
                {step.tiles.map((t, i) => (
                  <div key={i} style={{ transform: step.type === "findSet" ? `rotate(${[-4, 3, -2, 5, -3, 2][i % 6]}deg)` : "none" }}>
                    <Tile t={t} deal={i} size={88} state={picked.includes(i) ? "selected" : wrong === i ? "wrong" : "idle"} onTap={() => tapMany(i)} />
                  </div>
                ))}
              </div>
              <p style={{ textAlign: "center", fontSize: 16, fontWeight: 800, margin: 0, color: stepDone ? T.success : T.sub }}>
                {stepDone ? "Found it!" : `${picked.length}/${step.correct.length} selected`}
              </p>
            </div>
          </>
        )}

        {step.type === "speed" && (
          <>
            <h2 style={promptStyle}>{step.prompt}</h2>
            <TeacherSays teacher={teacher}>{step.say(teacher)}</TeacherSays>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
              <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
                {/* countdown ring */}
                <svg width="150" height="150" style={{ position: "absolute", top: -16, pointerEvents: "none" }}>
                  <circle cx="75" cy="75" r="66" fill="none" stroke={T.barTrack} strokeWidth="6" />
                  <circle cx="75" cy="75" r="66" fill="none"
                    stroke={timeLeft != null && timeLeft < step.seconds * 0.4 ? T.danger : T.primary}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 66}
                    strokeDashoffset={2 * Math.PI * 66 * (1 - (timeLeft != null ? Math.max(0, timeLeft) / step.seconds : 1))}
                    transform="rotate(-90 75 75)"
                    style={{ transition: "stroke-dashoffset .08s linear, stroke .2s ease" }} />
                </svg>
                <Tile t={step.tile} size={104} state={choice === step.correct ? "correct" : timeUp ? "wrong" : "idle"} />
              </div>
              <ChoiceStack choices={step.choices} choice={choice} wrong={wrong} onPick={tapOne} />
            </div>
          </>
        )}
      </div>

      {/* bottom feedback sheet */}
      <div
        className={sheetState !== "idle" ? "ss-sheet" : ""}
        style={{
          padding: "14px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
          background: sheetState === "good" ? T.successSoft : sheetState === "hint" ? T.dangerSoft : T.surface,
          borderTop: `2px solid ${sheetState === "good" ? T.success + "55" : sheetState === "hint" ? T.danger + "44" : T.cardBorder}`,
          transition: "background .25s ease, border-color .25s ease",
        }}
      >
        {sheetState === "good" && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: T.success, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }}>✓</span>
            <span style={{ fontWeight: 800, fontSize: 17.5, color: T.successDeep, fontFamily: T.fontDisplay }}>
              Nice one!{gained ? " +10 ★" : ""}
            </span>
          </div>
        )}
        {sheetState === "hint" && (
          <div style={{ fontWeight: 800, fontSize: 15.5, color: T.danger, marginBottom: 11, lineHeight: 1.4 }}>
            {timeUp ? <>Too slow — at a real table that tile is gone. {step.hint}</> : <>Not quite — {step.hint}</>}
          </div>
        )}
        <Btn onClick={next} disabled={!stepDone} tone={sheetState === "good" ? "success" : "primary"}>
          {idx + 1 === total ? "Finish lesson" : "Continue"}
        </Btn>
      </div>
    </div>
  );
}

function Complete({ stars, lessonId, teacher, onHome, onSim }) {
  const T = useT();
  const A = teacher.Comp;
  const graduated = lessonId === 12;
  return (
    <div style={{ position: "relative", minHeight: "min(92dvh, 740px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 26px", textAlign: "center" }}>
      <Confetti />
      <A size={124} />
      <h2 style={{ fontFamily: T.fontDisplay, fontSize: 30, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: T.displaySpacing }}>
        {graduated ? "You're a mahjong graduate! 🀄" : lessonId === 6 ? "Unit 1 complete!" : "Lesson complete!"}
      </h2>
      <p style={{ fontSize: 16.5, color: T.sub, lineHeight: 1.6, margin: "0 0 20px", maxWidth: 360 }}>
        {COMPLETE_COPY[lessonId]}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 999, padding: "12px 24px", fontWeight: 800, fontSize: 19, color: T.ink, boxShadow: T.chipShadow, marginBottom: 24, backdropFilter: T.glass ? "blur(18px)" : undefined }}>
        <span style={{ color: T.star, fontSize: 22 }}>★</span> {stars} stars
      </div>
      {graduated && onSim && (
        <Btn onClick={onSim} tone="success" style={{ maxWidth: 330, marginBottom: 10 }}>🀄 Play your first real game</Btn>
      )}
      <Btn onClick={onHome} tone={graduated ? "primary" : "primary"} style={{ maxWidth: 330, ...(graduated ? { background: T.card, color: T.ink, boxShadow: T.cardShadow, border: `1.5px solid ${T.cardBorder}` } : {}) }}>Back to the line</Btn>
    </div>
  );
}

function ToggleRow({ icon, title, desc, storeKey, defaultOn = true, inverted = false, onChange }) {
  const T = useT();
  // for inverted keys (e.g. "muted"), storeKey===1 means OFF
  const read = () => {
    try { const v = localStorage.getItem(storeKey); if (v === null) return defaultOn; return inverted ? v !== "1" : v === "1"; } catch (e) { return defaultOn; }
  };
  const [on, setOn] = useState(read);
  const toggle = () => {
    const next = !on; setOn(next);
    try { localStorage.setItem(storeKey, inverted ? (next ? "0" : "1") : (next ? "1" : "0")); } catch (e) {}
    onChange && onChange(next);
  };
  return (
    <CardBox onClick={toggle} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", minHeight: 66 }}>
      <span style={{ fontSize: 19, width: 28, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 15.5, color: T.ink, fontFamily: T.fontDisplay }}>{title}</div>
        <div style={{ fontSize: 12.5, color: T.sub, marginTop: 1 }}>{desc}</div>
      </div>
      <div style={{ width: 46, height: 27, borderRadius: 999, background: on ? T.primary : T.barTrack, position: "relative", transition: "background .2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", transition: "left .2s" }} />
      </div>
    </CardBox>
  );
}

function Settings({ themeId, setThemeId, teacherId, setTeacherId, account, onAccount, onBack }) {
  const T = useT();
  return (
    <div style={{ padding: "0 18px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0 10px" }}>
        <button onClick={onBack} aria-label="Back" style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, width: 46, height: 46, fontSize: 19, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow, WebkitTapHighlightColor: "transparent" }}>‹</button>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: T.displaySpacing }}>Settings</h2>
      </div>

      <h3 style={{ fontSize: 13.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".07em", margin: "18px 0 10px" }}>Account</h3>
      <CardBox onClick={onAccount} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", minHeight: 70 }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: account ? T.successSoft : T.barTrack, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {account ? "✓" : "☁︎"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: T.ink, fontFamily: T.fontDisplay }}>
            {account ? account.label : "Save your progress"}
          </div>
          <div style={{ fontSize: 13, color: T.sub, marginTop: 1 }}>
            {account ? "Synced across your devices" : "Sign in to keep your stars & streak"}
          </div>
        </div>
        <span style={{ color: T.sub, fontSize: 20, fontWeight: 800 }}>›</span>
      </CardBox>

      <h3 style={{ fontSize: 13.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".07em", margin: "18px 0 10px" }}>Game</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <ToggleRow icon="🔊" title="Sound & parlor ambience" desc="Off by default — hi-fi audio coming soon"
          storeKey="ma.muted" inverted defaultOn={false} onChange={(on) => SOUND.setMuted(!on)} />
        <ToggleRow icon="💡" title="In-game tips" desc="Rotating reminders during the simulation"
          storeKey="ma.simTips" defaultOn />
      </div>


      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {Object.values(THEMES).map((th) => (
          <CardBox key={th.id} onClick={() => setThemeId(th.id)} selected={themeId === th.id}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 15px", minHeight: 74 }}>
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              {[th.primary, th.star, th.neonPink].map((c, i) => (
                <span key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: "1.5px solid rgba(0,0,0,.08)" }} />
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16.5, color: T.ink, fontFamily: th.fontDisplay }}>{th.label}</div>
              <div style={{ fontSize: 13.5, color: T.sub, marginTop: 1 }}>{th.desc}</div>
            </div>
            <span style={{ width: 27, height: 27, borderRadius: "50%", flexShrink: 0, border: `2px solid ${themeId === th.id ? T.primary : T.cardBorder}`, background: themeId === th.id ? T.primary : "transparent", color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{themeId === th.id ? "✓" : ""}</span>
          </CardBox>
        ))}
      </div>

      <h3 style={{ fontSize: 13.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".07em", margin: "26px 0 10px" }}>Your teacher</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {TEACHERS.map((tc) => {
          const A = tc.Comp;
          return (
            <CardBox key={tc.id} onClick={() => setTeacherId(tc.id)} selected={teacherId === tc.id}
              style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", minHeight: 80 }}>
              <A size={56} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16.5, color: T.ink, fontFamily: T.fontDisplay }}>
                  {tc.name} <span style={{ fontWeight: 700, fontSize: 14, color: T.sub }}>{tc.title}</span>
                </div>
                <div style={{ fontSize: 13.5, color: T.sub, marginTop: 1 }}>{tc.tag}</div>
              </div>
              <span style={{ width: 27, height: 27, borderRadius: "50%", flexShrink: 0, border: `2px solid ${teacherId === tc.id ? T.primary : T.cardBorder}`, background: teacherId === tc.id ? T.primary : "transparent", color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{teacherId === tc.id ? "✓" : ""}</span>
            </CardBox>
          );
        })}
      </div>

      <p style={{ fontSize: 13, color: T.sub, textAlign: "center", marginTop: 22 }}>
        Theme, teacher & progress save to your device in the real app.
      </p>
    </div>
  );
}

/* ---------------- LANDING PAGE (front door) ---------------- */

function NeonChar({ ch, color, delay = 0 }) {
  return (
    <span style={{
      fontFamily: "'Noto Sans TC','PingFang TC',sans-serif", fontWeight: 700,
      color, textShadow: `0 0 8px ${color}, 0 0 20px ${color}99, 0 0 40px ${color}55`,
      animation: `ssflicker 4s ${delay}s infinite`,
    }}>{ch}</span>
  );
}

function Landing({ onStart, teacher, returning, completedCount }) {
  const T = useT();
  const A = teacher.Comp;
  const steps = [
    { n: "01", t: "Meet the tiles", d: "Suits, winds, dragons & flowers — with mnemonics so you never memorize a character cold." },
    { n: "02", t: "Build & win", d: "Pungs, chows, pairs, and the one winning shape: 4 sets + a pair." },
    { n: "03", t: "Play for real", d: "Turns, discards, calling 碰 and 食糊, and a timed round so you're table-fast." },
  ];
  const faqs = [
    ["Do I need to read Chinese?", "No. The whole app is built around shape-matching, not reading — and every character comes with a memory trick."],
    ["Which mahjong is this?", "Hong Kong / Cantonese style — the one most families play. Riichi & American tracks are on the way."],
    ["Is it free?", "Yes. The full beginner course and a daily puzzle are free, forever. No ads."],
    ["How long does it take?", "About five minutes a lesson. Most people can hold their own at a table in a week."],
  ];
  return (
    <div className="ss-landing" style={{ overflow: "hidden" }}>
      <style>{`
        @media (min-width: 768px) {
          .ss-landing .ss-land-band { display: flex; justify-content: center; }
          .ss-landing .ss-land-inner { width: 100%; max-width: 1040px; padding-left: 48px; padding-right: 48px; }
          .ss-landing .ss-land-hero-inner { width: 100%; max-width: 920px; margin: 0 auto; }
          .ss-landing .ss-hero-neon { font-size: 88px !important; }
          .ss-landing .ss-hero-tag { font-size: 16px !important; letter-spacing: .4em !important; }
          .ss-landing .ss-hero-h1 { font-size: 52px !important; }
          .ss-landing .ss-hero-sub { font-size: 20px !important; max-width: 540px !important; }
          .ss-landing .ss-hero-mascot { transform: scale(1.55); margin: 14px 0; }
          .ss-landing .ss-hero-cta { max-width: 380px !important; min-height: 66px !important; font-size: 20px !important; }
          .ss-landing .ss-hero-meta { font-size: 15px !important; }
          .ss-landing .ss-sec-kicker { font-size: 14px !important; }
          .ss-landing .ss-sec-h2 { font-size: 34px !important; }
          .ss-landing .ss-step-row { padding: 22px 24px !important; }
          .ss-landing .ss-step-n { font-size: 34px !important; min-width: 48px !important; }
          .ss-landing .ss-step-t { font-size: 22px !important; }
          .ss-landing .ss-step-d { font-size: 17px !important; }
          .ss-landing .ss-why-grid { grid-template-columns: repeat(4, 1fr) !important; gap: 16px !important; }
          .ss-landing .ss-why-card { padding: 22px 20px !important; }
          .ss-landing .ss-why-e { font-size: 34px !important; }
          .ss-landing .ss-why-t { font-size: 18px !important; }
          .ss-landing .ss-why-d { font-size: 15px !important; }
          .ss-landing .ss-faq-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 14px !important; }
          .ss-landing .ss-faq-q { font-size: 17px !important; }
          .ss-landing .ss-faq-a { font-size: 15.5px !important; }
          .ss-landing .ss-cta-h2 { font-size: 36px !important; }
          .ss-landing .ss-cta-p { font-size: 18px !important; max-width: 460px !important; }
          .ss-landing .ss-cta-btn { max-width: 380px !important; min-height: 64px !important; font-size: 20px !important; }
        }
        @media (min-width: 1180px) {
          .ss-landing .ss-land-inner { max-width: 1140px; }
          .ss-landing .ss-hero-neon { font-size: 104px !important; }
          .ss-landing .ss-hero-h1 { font-size: 60px !important; }
        }
      `}</style>
      {/* HERO */}
      <div style={{ position: "relative", background: "linear-gradient(180deg,#1A1230 0%,#2A1840 55%,#3A1E48 100%)", padding: "0 0 30px", overflow: "hidden" }}>
        <div className="ss-land-hero-inner">
        {/* neon harbour glow */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 60% at 50% 8%, rgba(255,77,141,.22), transparent 60%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "20px 22px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 22, color: "#fff" }}>
              mahjong<span style={{ color: "#FF4D8D", textShadow: "0 0 10px #FF4D8D88" }}>auntie</span>
            </div>
            <button onClick={onStart} style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontWeight: 800, fontSize: 13.5, padding: "8px 15px", borderRadius: 999, cursor: "pointer", backdropFilter: "blur(8px)", WebkitTapHighlightColor: "transparent" }}>Open app</button>
          </div>
        </div>

        {/* neon sign */}
        <div style={{ position: "relative", textAlign: "center", padding: "26px 22px 4px" }}>
          <div className="ss-hero-neon" style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: ".06em" }}>
            <NeonChar ch="麻" color="#FF4D8D" delay={0} />
            <NeonChar ch="雀" color="#34D0FF" delay={0.4} />
          </div>
          <div className="ss-hero-tag" style={{ marginTop: 6, color: "#FFC233", fontWeight: 700, fontSize: 13, letterSpacing: ".32em", textTransform: "uppercase", textShadow: "0 0 12px #FFC23366" }}>Learn Mahjong</div>
        </div>

        {/* headline */}
        <div style={{ position: "relative", textAlign: "center", padding: "18px 24px 0" }}>
          <h1 className="ss-hero-h1" style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 30, lineHeight: 1.18, color: "#fff", margin: 0, letterSpacing: "-.01em" }}>
            Learn mahjong before<br />you ever sit down.
          </h1>
          <p className="ss-hero-sub" style={{ color: "#D9CFE8", fontSize: 16, lineHeight: 1.55, margin: "12px auto 0", maxWidth: 360 }}>
            The friendly, tap-along way to learn Hong Kong–style mahjong — so your first real game isn't your first time seeing the tiles.
          </p>
        </div>

        {/* mascot + CTA */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 24px 0", gap: 16 }}>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <AuntieSpeech style={{ marginBottom: 14, zIndex: 2 }} />
            <div className="ss-hero-mascot" style={{ filter: "drop-shadow(0 8px 24px rgba(255,77,141,.35))" }}><A size={108} /></div>
          </div>
          {returning && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 999, padding: "7px 15px", color: "#fff", fontWeight: 800, fontSize: 13.5, backdropFilter: "blur(8px)" }}>
              👋 Welcome back · {completedCount} lesson{completedCount === 1 ? "" : "s"} done
            </div>
          )}
          <button onClick={onStart} className="ss-btn ss-hero-cta"
            style={{ width: "min(330px,100%)", minHeight: 60, fontSize: 18.5, fontWeight: 800, fontFamily: T.fontBody, color: "#fff", background: "#FF4D8D", border: "none", borderRadius: 18, boxShadow: "0 6px 24px rgba(255,77,141,.5), 0 4px 0 #C9296A", cursor: "pointer", letterSpacing: ".01em", WebkitTapHighlightColor: "transparent" }}>
            {returning ? "Continue learning →" : "Start learning — it's free"}
          </button>
          <div className="ss-hero-meta" style={{ color: "#B9AEC9", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
            <span>★ No ads</span><span>·</span><span>5 min a day</span><span>·</span><span>{returning ? "Your progress is saved" : "No sign-up needed"}</span>
          </div>
        </div>
        </div>{/* /hero-inner */}
      </div>

      {/* HOW IT WORKS */}
      <div className="ss-land-band" style={{ background: T.surface }}>
      <div className="ss-land-inner" style={{ padding: "30px 22px 6px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div className="ss-sec-kicker" style={{ fontSize: 12, fontWeight: 800, color: T.neonPink, textTransform: "uppercase", letterSpacing: ".14em" }}>How it works</div>
          <h2 className="ss-sec-h2" style={{ fontFamily: T.fontDisplay, fontSize: 25, fontWeight: 800, color: T.ink, margin: "6px 0 0", letterSpacing: T.displaySpacing }}>Three steps to the table</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map((s) => (
            <div key={s.n} className="ss-step-row" style={{ display: "flex", gap: 14, alignItems: "flex-start", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: T.radius, padding: "16px 16px", boxShadow: T.cardShadow }}>
              <div className="ss-step-n" style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 24, color: T.neonPink, lineHeight: 1, minWidth: 34, textShadow: T.neon ? `0 0 10px ${T.neonPink}55` : "none" }}>{s.n}</div>
              <div>
                <div className="ss-step-t" style={{ fontWeight: 800, fontSize: 17, color: T.ink, fontFamily: T.fontDisplay }}>{s.t}</div>
                <div className="ss-step-d" style={{ fontSize: 14.5, color: T.sub, marginTop: 3, lineHeight: 1.5 }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>{/* /how-it-works band */}

      {/* WHY IT'S DIFFERENT */}
      <div className="ss-land-band">
      <div className="ss-land-inner" style={{ padding: "26px 22px 6px" }}>
        <div className="ss-why-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
          {[
            { e: "🀄", t: "Tap, don't read", d: "Built on matching shapes, not memorizing Chinese." },
            { e: "🎴", t: "Real HK tiles", d: "Authentic faces, calls & etiquette — table-ready." },
            { e: "🏮", t: "Vintage HK soul", d: "Neon, junk boats & dim sum, in every screen." },
            { e: "🔥", t: "A daily puzzle", d: "One “what would you discard?” to keep you sharp." },
          ].map((c, i) => (
            <div key={i} className="ss-why-card" style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: T.radius, padding: "15px 14px", boxShadow: T.cardShadow }}>
              <div className="ss-why-e" style={{ fontSize: 26 }}>{c.e}</div>
              <div className="ss-why-t" style={{ fontWeight: 800, fontSize: 15.5, color: T.ink, marginTop: 6, fontFamily: T.fontDisplay }}>{c.t}</div>
              <div className="ss-why-d" style={{ fontSize: 13, color: T.sub, marginTop: 3, lineHeight: 1.45 }}>{c.d}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* FAQ */}
      <div className="ss-land-band">
      <div className="ss-land-inner" style={{ padding: "26px 22px 8px" }}>
        <h2 className="ss-sec-h2" style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.ink, margin: "0 0 14px", textAlign: "center", letterSpacing: T.displaySpacing }}>Good to know</h2>
        <div className="ss-faq-grid" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 15, padding: "13px 15px", boxShadow: T.cardShadow }}>
              <div className="ss-faq-q" style={{ fontWeight: 800, fontSize: 15, color: T.ink }}>{f[0]}</div>
              <div className="ss-faq-a" style={{ fontSize: 14, color: T.sub, marginTop: 4, lineHeight: 1.5 }}>{f[1]}</div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* FINAL CTA */}
      <div style={{ position: "relative", margin: "20px 0 0", padding: "34px 24px calc(36px + env(safe-area-inset-bottom,0px))", textAlign: "center", background: "linear-gradient(180deg,#2A1840 0%,#1A1230 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(100% 80% at 50% 100%, rgba(52,208,255,.18), transparent 60%)" }} />
        <div style={{ position: "relative", maxWidth: 760, margin: "0 auto" }}>
          <HarborScene height={70} />
          <h2 className="ss-cta-h2" style={{ position: "relative", fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 24, color: "#fff", margin: "18px 0 6px" }}>Your auntie is waiting.</h2>
          <p className="ss-cta-p" style={{ position: "relative", color: "#C9BEDC", fontSize: 15, margin: "0 auto 18px", maxWidth: 320, lineHeight: 1.5 }}>Walk up to the table already knowing how to play. Start now — no account, no catch.</p>
          <button onClick={onStart} className="ss-btn ss-cta-btn"
            style={{ position: "relative", width: "min(320px,100%)", minHeight: 58, fontSize: 18, fontWeight: 800, fontFamily: T.fontBody, color: "#1A1230", background: "#FFC233", border: "none", borderRadius: 18, boxShadow: "0 4px 0 #C9920F", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            Start learning
          </button>
          <div style={{ position: "relative", marginTop: 22, color: "#7E7191", fontSize: 12 }}>A Rock Paper Chopsticks product · mahjongauntie.com</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ACCOUNT / AUTH (prototype) ---------------- */

function Account({ account, onSendLink, onSignOut, onBack, stars, completed, cloudOn }) {
  const T = useT();
  const [email, setEmail] = useState("");
  const [emailMode, setEmailMode] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    setErr("");
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr("Please enter a valid email."); return; }
    setBusy(true);
    const ok = await onSendLink(email);
    setBusy(false);
    if (ok === true) setSent(true);
    else setErr(typeof ok === "string" ? ok : "Couldn't send the link — try again.");
  };

  return (
    <div style={{ padding: "0 18px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0 10px" }}>
        <button onClick={onBack} aria-label="Back" style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, width: 46, height: 46, fontSize: 19, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow, WebkitTapHighlightColor: "transparent" }}>‹</button>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: T.displaySpacing }}>Account</h2>
      </div>

      {account ? (
        <>
          <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", margin: "0 auto 12px", background: T.successSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>✓</div>
            <div style={{ fontWeight: 800, fontSize: 19, color: T.ink, fontFamily: T.fontDisplay, wordBreak: "break-all" }}>{account.label}</div>
            <div style={{ fontSize: 14, color: T.sub, marginTop: 3 }}>Signed in with {account.provider} · progress synced</div>
          </div>
          <div style={{ display: "flex", gap: 11, margin: "18px 0 22px" }}>
            <div style={{ flex: 1, textAlign: "center", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "16px 0", boxShadow: T.cardShadow }}>
              <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 26, color: T.ink }}>★ {stars}</div>
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>stars earned</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "16px 0", boxShadow: T.cardShadow }}>
              <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 26, color: T.ink }}>{completed.length}/{LESSONS.length}</div>
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>lessons done</div>
            </div>
          </div>
          <button onClick={onSignOut} style={{ width: "100%", minHeight: 52, fontWeight: 800, fontSize: 16, fontFamily: T.fontBody, color: T.danger, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: T.cardShadow, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Sign out</button>
        </>
      ) : sent ? (
        <div style={{ textAlign: "center", padding: "36px 14px" }}>
          <div style={{ fontSize: 46 }}>✉️</div>
          <h3 style={{ fontFamily: T.fontDisplay, fontSize: 21, fontWeight: 800, color: T.ink, margin: "12px 0 8px" }}>Check your email</h3>
          <p style={{ fontSize: 15, color: T.sub, lineHeight: 1.55, margin: "0 auto", maxWidth: 320 }}>
            We sent a sign-in link to <b style={{ color: T.ink }}>{email}</b>. Tap it on this device to finish — your progress comes with you. (Check spam if you don't see it.)
          </p>
        </div>
      ) : (
        <>
          <div style={{ textAlign: "center", padding: "18px 10px 6px" }}>
            <div style={{ fontSize: 40 }}>☁︎</div>
            <h3 style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 800, color: T.ink, margin: "8px 0 6px" }}>Keep your progress safe</h3>
            <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.55, margin: "0 auto", maxWidth: 320 }}>
              You're learning as a guest — everything's saved {cloudOn ? "to this device for now" : "on this device"}. Sign in to sync your stars and streak across your phone, tablet, and laptop.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 22 }}>
            {/* Apple & Google — enable in Supabase, then wire (see notes) */}
            {[
              { id: "apple", label: "Continue with Apple", bg: "#000", fg: "#fff", mark: "" },
              { id: "google", label: "Continue with Google", bg: "#fff", fg: "#3A3A40", mark: "G" },
            ].map((p) => (
              <button key={p.id} disabled
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative",
                  width: "100%", minHeight: 56, fontSize: 16.5, fontWeight: 800, fontFamily: T.fontBody,
                  color: p.fg, background: p.bg, opacity: .55,
                  border: p.id === "google" ? `1.5px solid ${T.cardBorder}` : "none",
                  borderRadius: 16, cursor: "default", WebkitTapHighlightColor: "transparent",
                }}>
                {p.mark && <span style={{ fontWeight: 800, fontSize: 18 }}>{p.mark}</span>}
                {p.label}
                <span style={{ position: "absolute", right: 12, fontSize: 10.5, fontWeight: 800, background: "rgba(255,255,255,.25)", color: "inherit", borderRadius: 999, padding: "3px 8px", textTransform: "uppercase", letterSpacing: ".04em" }}>soon</span>
              </button>
            ))}

            {!emailMode ? (
              <button onClick={() => setEmailMode(true)} className="ss-btn"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", minHeight: 56, fontSize: 16.5, fontWeight: 800, fontFamily: T.fontBody, color: "#fff", background: T.primary, border: "none", borderRadius: 16, cursor: "pointer", boxShadow: T.btnEdge ? `0 4px 0 ${T.primaryDeep}` : "0 2px 10px rgba(0,0,0,.12)", WebkitTapHighlightColor: "transparent" }}>
                <span style={{ fontSize: 18 }}>✉</span> Email me a sign-in link
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="email" inputMode="email" autoCapitalize="off" autoCorrect="off"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  style={{ width: "100%", minHeight: 54, padding: "0 16px", fontSize: 16.5, fontFamily: T.fontBody, color: T.ink, background: T.card, border: `1.5px solid ${err ? T.danger : T.cardBorder}`, borderRadius: 14, outline: "none", WebkitTapHighlightColor: "transparent" }}
                />
                <Btn onClick={send} disabled={busy}>{busy ? "Sending…" : "Send link"}</Btn>
                {err && <p style={{ fontSize: 13.5, color: T.danger, fontWeight: 700, textAlign: "center", margin: 0 }}>{err}</p>}
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: T.sub, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
            No passwords, ever. We'll never post anything or share your info.
            {!cloudOn && <><br /><span style={{ opacity: .8 }}>Cloud sync isn't configured yet — running in local mode.</span></>}
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------- save-progress nudge (post-lesson) ---------------- */

function SaveNudge({ onSignIn, onLater }) {
  const T = useT();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(26,18,32,.5)", backdropFilter: "blur(3px)" }}>
      <div className="ss-sheet" style={{ width: "min(480px,100%)", background: T.surface, borderRadius: "26px 26px 0 0", padding: "24px 22px calc(24px + env(safe-area-inset-bottom,0px))", textAlign: "center", boxShadow: "0 -10px 40px rgba(0,0,0,.2)" }}>
        <div style={{ width: 44, height: 5, borderRadius: 999, background: T.cardBorder, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 36 }}>☁︎</div>
        <h3 style={{ fontFamily: T.fontDisplay, fontSize: 21, fontWeight: 800, color: T.ink, margin: "8px 0 6px" }}>Nice progress — want to keep it?</h3>
        <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.5, margin: "0 auto 18px", maxWidth: 320 }}>
          You've earned stars worth saving. Sync them across your devices in one tap — no password needed.
        </p>
        <Btn onClick={onSignIn}>Save my progress</Btn>
        <button onClick={onLater} style={{ width: "100%", marginTop: 10, minHeight: 48, fontWeight: 800, fontSize: 15.5, fontFamily: T.fontBody, color: T.sub, background: "transparent", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Maybe later</button>
      </div>
    </div>
  );
}

/* ---------------- BOTTOM NAV ---------------- */

function BottomNav({ active, onNav }) {
  const T = useT();
  const items = [
    { id: "home", label: "Learn", icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7l8-4 8 4-8 4-8-4z" fill={on ? T.primary : "none"} stroke={on ? T.primary : T.sub} strokeWidth="1.8" strokeLinejoin="round"/><path d="M4 7v6c0 1 3.6 3 8 3s8-2 8-3V7" stroke={on ? T.primary : T.sub} strokeWidth="1.8" strokeLinecap="round"/></svg>
    )},
    { id: "daily", label: "Daily", icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15" rx="3" fill={on ? T.primary + "22" : "none"} stroke={on ? T.primary : T.sub} strokeWidth="1.8"/><path d="M3.5 9h17M8 3v3M16 3v3" stroke={on ? T.primary : T.sub} strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="14.5" r="2" fill={on ? T.primary : T.sub}/></svg>
    )},
    { id: "profile", label: "Profile", icon: (on) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.6" fill={on ? T.primary + "22" : "none"} stroke={on ? T.primary : T.sub} strokeWidth="1.8"/><path d="M5 19c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke={on ? T.primary : T.sub} strokeWidth="1.8" strokeLinecap="round"/></svg>
    )},
  ];
  return (
    <nav style={{
      position: "sticky", bottom: 0, zIndex: 20,
      display: "flex", background: T.glass ? "rgba(255,255,255,.82)" : T.surface,
      backdropFilter: T.glass ? "blur(20px)" : undefined,
      borderTop: `1.5px solid ${T.cardBorder}`,
      padding: "8px 8px calc(8px + env(safe-area-inset-bottom,0px))",
    }}>
      {items.map((it) => {
        const on = active === it.id;
        return (
          <button key={it.id} onClick={() => onNav(it.id)}
            style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 0", WebkitTapHighlightColor: "transparent" }}>
            <span className={on ? "ss-navpop" : ""}>{it.icon(on)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: on ? T.primary : T.sub, fontFamily: T.fontBody }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ---------------- DAILY PUZZLE (placeholder) ---------------- */

function Daily({ teacher, onLogo, onSettings, stars }) {
  const T = useT();
  return (
    <div style={{ padding: "0 18px 30px", minHeight: "70vh" }}>
      <Header stars={stars} onSettings={onSettings} onLogo={onLogo} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingTop: 40, gap: 14 }}>
        <div style={{ fontSize: 46 }}>🀙</div>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: T.displaySpacing }}>Daily Discard</h2>
        <p style={{ fontSize: 15, color: T.sub, lineHeight: 1.55, maxWidth: 320, margin: 0 }}>
          One hand a day, the same for everyone: <b>“what would you discard?”</b> Build a streak, compare with friends, keep your eye sharp.
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 999, padding: "9px 18px", fontWeight: 800, fontSize: 14, color: T.sub, boxShadow: T.chipShadow, marginTop: 6 }}>
          🔥 Coming soon
        </div>
      </div>
    </div>
  );
}

/* ---------------- PROFILE ---------------- */

function Profile({ teacher, account, stars, completed, onLogo, onSettings, onAccount }) {
  const T = useT();
  const A = teacher.Comp;
  return (
    <div style={{ padding: "0 18px 30px" }}>
      <Header stars={stars} onSettings={onSettings} onLogo={onLogo} />
      <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
        <div style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,.12))" }}><A size={92} /></div>
        <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 20, color: T.ink, marginTop: 8 }}>
          {account ? account.label : "Guest learner"}
        </div>
        <div style={{ fontSize: 13.5, color: T.sub, marginTop: 2 }}>
          {account ? `Synced with ${account.provider}` : "Learning on this device"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 11, margin: "18px 0" }}>
        {[["★ " + stars, "stars"], [completed.length + "/" + LESSONS.length, "lessons"], ["0", "day streak"]].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "15px 0", boxShadow: T.cardShadow }}>
            <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 22, color: T.ink }}>{s[0]}</div>
            <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{s[1]}</div>
          </div>
        ))}
      </div>
      {!account && (
        <CardBox onClick={onAccount} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", minHeight: 68, marginBottom: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: T.barTrack, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>☁︎</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, color: T.ink, fontFamily: T.fontDisplay }}>Save your progress</div>
            <div style={{ fontSize: 13, color: T.sub, marginTop: 1 }}>Sync stars & streak across devices</div>
          </div>
          <span style={{ color: T.sub, fontSize: 20, fontWeight: 800 }}>›</span>
        </CardBox>
      )}
      <CardBox onClick={onSettings} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 15px", minHeight: 60 }}>
        <span style={{ fontSize: 19, width: 30, textAlign: "center" }}>⚙︎</span>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 15.5, color: T.ink, fontFamily: T.fontDisplay }}>Settings</div>
        <span style={{ color: T.sub, fontSize: 20, fontWeight: 800 }}>›</span>
      </CardBox>
    </div>
  );
}

/* ================= SIMULATION: engine (validated) ================= */

function simKey(t) {
  if (t.s === "dots") return "o" + t.n;
  if (t.s === "bamboo") return "b" + t.n;
  if (t.s === "char") return "k" + t.n;
  if (t.s === "wind") return "w" + t.c;
  return "z" + t.d;
}
function simFromKey(k) {
  const p = k[0], r = k.slice(1);
  if (p === "o") return { s: "dots", n: +r };
  if (p === "b") return { s: "bamboo", n: +r };
  if (p === "k") return { s: "char", n: +r };
  if (p === "w") return { s: "wind", c: r };
  return { s: "dragon", d: r };
}
const simSuited = (k) => k[0] === "o" || k[0] === "b" || k[0] === "k";
const SIM_WIND_ORD = { "東": 0, "南": 1, "西": 2, "北": 3 };
const SIM_DRAG_ORD = { r: 0, g: 1, w: 2 };
function simRank(k) {
  const n = +k.slice(1);
  if (k[0] === "o") return 0 + n / 100;
  if (k[0] === "b") return 1 + n / 100;
  if (k[0] === "k") return 2 + n / 100;
  if (k[0] === "w") return 3 + SIM_WIND_ORD[k.slice(1)] / 100;
  return 4 + SIM_DRAG_ORD[k.slice(1)] / 100;
}
const simSort = (keys) => [...keys].sort((a, b) => simRank(a) - simRank(b));
function simWall() {
  const w = [];
  for (const p of ["o", "b", "k"]) for (let n = 1; n <= 9; n++) for (let i = 0; i < 4; i++) w.push(p + n);
  for (const c of ["東", "南", "西", "北"]) for (let i = 0; i < 4; i++) w.push("w" + c);
  for (const d of ["r", "g", "w"]) for (let i = 0; i < 4; i++) w.push("z" + d);
  for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [w[i], w[j]] = [w[j], w[i]]; }
  return w;
}
function simCounts(keys) { const m = {}; for (const k of keys) m[k] = (m[k] || 0) + 1; return m; }
function simDecompose(c, need) {
  const keys = Object.keys(c).filter((k) => c[k] > 0).sort();
  if (keys.length === 0) return need === 0;
  if (need === 0) return false;
  const k = keys[0];
  if (c[k] >= 3) { c[k] -= 3; if (simDecompose(c, need - 1)) { c[k] += 3; return true; } c[k] += 3; }
  if (simSuited(k)) {
    const s = k[0], n = +k.slice(1), k1 = s + (n + 1), k2 = s + (n + 2);
    if (n <= 7 && c[k1] > 0 && c[k2] > 0) {
      c[k]--; c[k1]--; c[k2]--;
      if (simDecompose(c, need - 1)) { c[k]++; c[k1]++; c[k2]++; return true; }
      c[k]++; c[k1]++; c[k2]++;
    }
  }
  return false;
}
function simIsWin(handKeys, meldsCount) {
  const need = 4 - meldsCount;
  if (handKeys.length !== need * 3 + 2) return false;
  const c = simCounts(handKeys);
  for (const k of Object.keys(c)) {
    if (c[k] >= 2) { c[k] -= 2; if (simDecompose(c, need)) { c[k] += 2; return true; } c[k] += 2; }
  }
  return false;
}
const simCanPung = (h, t) => h.filter((k) => k === t).length >= 2;
function simCanChow(h, t) {
  if (!simSuited(t)) return false;
  const s = t[0], n = +t.slice(1), has = (x) => h.includes(s + x);
  return (n >= 3 && has(n - 2) && has(n - 1)) || (n >= 2 && n <= 8 && has(n - 1) && has(n + 1)) || (n <= 7 && has(n + 1) && has(n + 2));
}
const simCanWinWith = (h, m, t) => simIsWin([...h, t], m);
function simUseful(k, c) {
  let s = (c[k] - 1) * 3;
  if (simSuited(k)) {
    const su = k[0], n = +k.slice(1);
    for (const [d, w] of [[-1, 2], [1, 2], [-2, 1], [2, 1]]) { const nn = n + d; if (nn >= 1 && nn <= 9 && c[su + nn] > 0) s += w; }
  }
  return s;
}
function simBotDiscard(h) {
  const c = simCounts(h);
  let worst = h[0], ws = Infinity;
  for (const k of [...new Set(h)]) { const u = simUseful(k, c) + Math.random() * 0.5; if (u < ws) { ws = u; worst = k; } }
  return worst;
}

// readable tile name for coaching ("5 Dots", "South wind", "Red dragon")
function simLabel(k) {
  const SU = { o: "Dots", b: "Bamboo", k: "Characters" };
  if (simSuited(k)) return `${k.slice(1)} ${SU[k[0]]}`;
  if (k[0] === "w") return `${k.slice(1)} wind`;
  return ({ r: "Red", g: "Green", w: "White" })[k.slice(1)] + " dragon";
}

// analyze YOUR hand: which tiles to keep (collecting), which to throw, + a beginner tip
function analyzeSimHand(handKeys) {
  const c = simCounts(handKeys);
  const keep = new Set();
  for (const k of Object.keys(c)) if (c[k] >= 2) keep.add(k);          // pairs / triplets
  for (const k of handKeys) {                                          // near-runs
    if (!simSuited(k)) continue;
    const s = k[0], n = +k.slice(1);
    for (const d of [-2, -1, 1, 2]) { const nn = n + d; if (nn >= 1 && nn <= 9 && c[s + nn] > 0) { keep.add(k); break; } }
  }
  let worst = null, ws = Infinity;
  for (const k of [...new Set(handKeys)]) { const u = simUseful(k, c); if (u < ws) { ws = u; worst = k; } }

  // build the most useful single beginner tip, in priority order
  const honorPair = Object.keys(c).find((k) => (k[0] === "w" || k[0] === "z") && c[k] >= 2);
  const anyPair = Object.keys(c).find((k) => c[k] === 2);
  let run = null;
  for (const k of handKeys) { if (simSuited(k)) { const s = k[0], n = +k.slice(1); if (c[s + (n + 1)] > 0) { run = [k, s + (n + 1)]; break; } } }
  let msg;
  if (honorPair) msg = `Hold your ${simLabel(honorPair)} pair — honors & your seat wind score points. Throw the lone ${worst ? simLabel(worst) : "tile"}.`;
  else if (anyPair && run) msg = `You're building: keep your pair of ${simLabel(anyPair)} and the ${simLabel(run[0])}–${simLabel(run[1])} run. Throw the lone ${worst ? simLabel(worst) : "tile"}.`;
  else if (anyPair) msg = `Keep your pair of ${simLabel(anyPair)} — one more makes a Pung. Safe to throw the lone ${worst ? simLabel(worst) : "tile"}.`;
  else if (run) msg = `Keep ${simLabel(run[0])} & ${simLabel(run[1])} — they want one more for a run. Throw the lone ${worst ? simLabel(worst) : "tile"}.`;
  else msg = `No pairs yet — throw your most isolated tile (${worst ? simLabel(worst) : "the lone one"}) and aim to collect pairs or runs.`;

  return { keep, worst, msg };
}

/* ================= SIMULATION: UI ================= */

const SEAT_INFO = [
  { name: "You", wind: "東", tag: "dealer" },     // bottom
  { name: "Auntie", wind: "南", tag: "" },          // right
  { name: "Uncle", wind: "西", tag: "" },           // top
  { name: "Grandma", wind: "北", tag: "" },         // left
];

// Compact cartoon busts that sit around the table (read well at ~50px).
function SeatBust({ who, size = 52, active }) {
  const ring = active ? "#FFD54A" : "rgba(255,255,255,.35)";
  const common = { width: size, height: size, style: { display: "block" } };
  const Frame = ({ children }) => (
    <svg viewBox="0 0 64 64" {...common}>
      <circle cx="32" cy="32" r="31" fill="#1C3A2B" stroke={ring} strokeWidth="2.5" className={active ? "ss-pulsering" : ""} />
      <clipPath id={`c${who}`}><circle cx="32" cy="32" r="29" /></clipPath>
      <g clipPath={`url(#c${who})`}>{children}</g>
    </svg>
  );
  if (who === "auntie") return (
    <Frame>
      <rect x="0" y="0" width="64" height="64" fill="#F7E9D8" />
      <path d="M10 64 q0 -16 22 -16 q22 0 22 16 Z" fill="#2FA877" />
      <path d="M24 50 q8 6 16 0 l-3 7 q-5 3 -10 0 Z" fill="#FF7FA8" />
      <path d="M14 30 q-2 -22 18 -23 q20 1 18 23 q1 9 -4 12 q1 -8 -2 -11 q-12 5 -24 0 q-3 3 -2 11 q-5 -3 -4 -12 Z" fill="#2E2A33" />
      <circle cx="32" cy="30" r="16" fill="#F4CDA4" />
      <path d="M18 20 q5 -6 14 -4 q9 -2 14 4 q-7 -2 -14 0 q-7 -2 -14 0 Z" fill="#2E2A33" />
      <ellipse cx="24" cy="34" rx="3.4" ry="2.2" fill="#FF9DBA" opacity=".7" />
      <ellipse cx="40" cy="34" rx="3.4" ry="2.2" fill="#FF9DBA" opacity=".7" />
      <g stroke="#D8A82E" strokeWidth="1.8" fill="rgba(255,255,255,.15)"><rect x="20" y="26" width="9" height="7" rx="3" /><rect x="35" y="26" width="9" height="7" rx="3" /></g>
      <circle cx="24.5" cy="29.5" r="1.7" fill="#33303A" /><circle cx="39.5" cy="29.5" r="1.7" fill="#33303A" />
      <path d="M27 40 q5 4 10 0" stroke="#C25C70" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Frame>
  );
  if (who === "uncle") return (
    <Frame>
      <rect x="0" y="0" width="64" height="64" fill="#E8EEF2" />
      <path d="M10 64 q0 -16 22 -16 q22 0 22 16 Z" fill="#3B6EA5" />
      <path d="M26 49 h12 v9 h-12 Z" fill="#F4CDA4" />
      <path d="M32 50 l3 6 -3 2 -3 -2 Z" fill="#C0392B" />
      <circle cx="32" cy="30" r="16" fill="#F0C49A" />
      {/* balding with side hair */}
      <path d="M16 28 q0 -16 16 -16 q16 0 16 16 q-4 -9 -16 -9 q-12 0 -16 9 Z" fill="#6B6B6B" />
      <path d="M15 28 q-2 8 3 12 q-2 -8 0 -12 Z M49 28 q2 8 -3 12 q2 -8 0 -12 Z" fill="#6B6B6B" />
      {/* glasses */}
      <g stroke="#4A4A4A" strokeWidth="1.8" fill="rgba(255,255,255,.12)"><rect x="19" y="26" width="10" height="8" rx="2" /><rect x="35" y="26" width="10" height="8" rx="2" /></g>
      <line x1="29" y1="30" x2="35" y2="30" stroke="#4A4A4A" strokeWidth="1.8" />
      <circle cx="24" cy="30" r="1.7" fill="#33303A" /><circle cx="40" cy="30" r="1.7" fill="#33303A" />
      {/* mustache + slight grin */}
      <path d="M25 41 q7 3 14 0" stroke="#6B6B6B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M27 39 q5 2 10 0" stroke="#9A6B4F" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </Frame>
  );
  if (who === "grandma") return (
    <Frame>
      <rect x="0" y="0" width="64" height="64" fill="#F3ECEF" />
      <path d="M10 64 q0 -16 22 -16 q22 0 22 16 Z" fill="#8E5BA8" />
      <path d="M24 50 q8 5 16 0 l-2 7 q-6 3 -12 0 Z" fill="#EAD9F0" />
      {/* silver bun */}
      <circle cx="32" cy="11" r="6" fill="#D9D9DE" />
      <path d="M14 30 q-2 -20 18 -21 q20 1 18 21 q1 8 -4 11 q1 -7 -2 -10 q-12 4 -24 0 q-3 3 -2 10 q-5 -3 -4 -11 Z" fill="#D9D9DE" />
      <circle cx="32" cy="31" r="16" fill="#F2C9A8" />
      <ellipse cx="24" cy="35" rx="3.2" ry="2" fill="#F2A6B8" opacity=".7" />
      <ellipse cx="40" cy="35" rx="3.2" ry="2" fill="#F2A6B8" opacity=".7" />
      {/* round glasses */}
      <g stroke="#B08A4A" strokeWidth="1.6" fill="rgba(255,255,255,.12)"><circle cx="24" cy="30" r="5" /><circle cx="40" cy="30" r="5" /></g>
      <line x1="29" y1="30" x2="35" y2="30" stroke="#B08A4A" strokeWidth="1.6" />
      <circle cx="24" cy="30" r="1.6" fill="#33303A" /><circle cx="40" cy="30" r="1.6" fill="#33303A" />
      <path d="M27 40 q5 4 10 0" stroke="#C27C8A" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Frame>
  );
  // you
  return (
    <Frame>
      <rect x="0" y="0" width="64" height="64" fill="#FBF1E0" />
      <path d="M10 64 q0 -16 22 -16 q22 0 22 16 Z" fill="#E7B53C" />
      <path d="M16 26 q0 -15 16 -15 q16 0 16 15 q-3 -8 -16 -8 q-13 0 -16 8 Z" fill="#2E2A33" />
      <circle cx="32" cy="31" r="16" fill="#F4CDA4" />
      <circle cx="25" cy="30" r="1.8" fill="#33303A" /><circle cx="39" cy="30" r="1.8" fill="#33303A" />
      <path d="M27 39 q5 4 10 0" stroke="#C25C70" strokeWidth="2" fill="none" strokeLinecap="round" />
    </Frame>
  );
}
const SEAT_WHO = ["you", "auntie", "uncle", "grandma"];


// per-seat flavor lines (index matches SEAT_INFO). [1]=Auntie [2]=Uncle [3]=Grandma
const BOT_LINES = {
  1: { // Auntie
    discard: ["Aiyah, take this lah.", "I don't need this one.", "You want? Too bad.", "So-so hand only."],
    claim: ["Pung! Thank you ah.", "Mm-hm, I take that.", "Auntie needs it more."],
    win: ["Sik wu! Pay up, dear.", "Told you I had it.", "Easy money, aiyah."],
    youPung: ["Wah, so fast you.", "Okay okay, smart."],
  },
  2: { // Uncle
    discard: ["In my day, real money.", "Bah, useless tile.", "You sure about your hand?", "Hmph. Next."],
    claim: ["Pung! Ha, mine.", "Too slow, young one.", "I saw that coming."],
    win: ["Sik wu! Beginner's luck, no.", "I was playing before you born.", "Count my fan, ah."],
    youPung: ["Lucky grab only.", "Don't get cocky."],
  },
  3: { // Grandma
    discard: ["Slowly slowly, dear.", "Here, you take.", "Aiya, not this one.", "Have you eaten?"],
    claim: ["Pung, dear. So sorry.", "Grandma takes this.", "Oh, lucky me."],
    win: ["Sik wu! I let you try.", "My grandson plays nice too.", "Good game, sweetie."],
    youPung: ["Clever child.", "Just like your mother."],
  },
};
const botLine = (seat, kind) => { const s = BOT_LINES[seat]?.[kind]; return s ? s[Math.floor(Math.random() * s.length)] : null; };

// ---- table banter: bots converse WITH EACH OTHER ----
// Each exchange = {a: opener, b: reply}. Openers/replies are templated so the
// combinations are effectively endless. {n} = the other person's name.
const CONVO = [
  { a: "Have you eaten yet, {n}?", b: ["Aiya, twice already. You worry too much.", "Not yet — save me a seat after.", "You always ask me this!"] },
  { a: "When is your son getting married?", b: ["Don't start with me again.", "Soon soon, he says. Hmph.", "Ask his mother, not me."] },
  { a: "This tea is cold already.", b: ["Then drink faster lah.", "I told you, more hot water.", "Cold tea, cold luck."] },
  { a: "You're playing too slow today.", b: ["Good things take time, dear.", "Slow and steady wins, you'll see.", "At my age, everything is slow."] },
  { a: "Wah, your hand looks dangerous.", b: ["Bluffing only, don't worry.", "Maybe yes, maybe no.", "You'll find out soon enough."] },
  { a: "My grandson plays this on his phone now.", b: ["Phone! No soul in that.", "Times change, what to do.", "Tell him to call his grandma."] },
  { a: "Did you see the price of vegetables?", b: ["Robbery! Pure robbery.", "I grow my own now.", "Don't get me started, {n}."] },
  { a: "Sit up straight, you'll hurt your back.", b: ["Yes, yes, mother.", "My back is fine, thank you.", "You sound just like my wife."] },
  { a: "Lucky seat today, I can feel it.", b: ["You said that last week too.", "Feeling is not winning, dear.", "We'll see who's lucky."] },
  { a: "You cut your hair? Looks nice.", b: ["Finally someone notices!", "My daughter did it.", "Cheaper than the salon, lah."] },
  { a: "Aiya, my knees when it rains…", b: ["Drink more soup.", "Tell me about it.", "Old age is not for the weak, {n}."] },
  { a: "Don't discard the dragons so carelessly.", b: ["I know what I'm doing!", "Teaching me now, are you?", "Watch your own tiles."] },
];
function buildExchange() {
  const c = CONVO[Math.floor(Math.random() * CONVO.length)];
  const reply = c.b[Math.floor(Math.random() * c.b.length)];
  return { open: c.a, reply };
}


// rotating, non-intrusive in-game tips (glossary + strategy)
const SIM_TIPS = [
  "碰 Pung = three identical tiles. Claim from anyone.",
  "上 Chow = a run of 3 in one suit — only from the player on your left.",
  "食糊 (sik wu) = the winning call: 4 sets + a pair.",
  "The pair is the “eyes” 眼 (ngaan). Every hand needs exactly one.",
  "番 fan = points. Most tables need 3 fan to win.",
  "自摸 (zi mo) = self-draw. Worth more — everyone pays.",
  "Discard tip: lone honors with no pair are usually safe to throw.",
  "Watch the pond — a tile already discarded is safer to repeat.",
  "出銃 = you discard the tile someone wins on. Then you alone pay.",
  "Dragons 🀄 and your seat wind score fan — try to keep them paired.",
];

function TileBackRow({ n, horizontal }) {
  const T = useT();
  return (
    <div style={{ display: "flex", flexDirection: horizontal ? "column" : "row", gap: 2 }}>
      {Array.from({ length: Math.min(n, 13) }).map((_, i) => (
        <div key={i} style={{
          width: horizontal ? 22 : 13, height: horizontal ? 13 : 22, borderRadius: 3,
          background: "linear-gradient(135deg,#3FA877,#2E8C60)", border: "1px solid #246E4B",
        }} />
      ))}
    </div>
  );
}

function Seat({ seatIdx, seat, count, active, say, thinking, side }) {
  const T = useT();
  const who = SEAT_WHO[seatIdx];
  // bubble position depends on which edge the seat sits on
  const bubblePos = side === "top" ? { top: "100%", marginTop: 6 }
    : side === "left" ? { left: "100%", marginLeft: 6, top: 6 }
    : side === "right" ? { right: "100%", marginRight: 6, top: 6 }
    : { bottom: "100%", marginBottom: 6 };
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      {say && (
        <div className="ss-bubblein" style={{ position: "absolute", zIndex: 9, background: "#fff", color: "#2A2533", fontWeight: 700, fontSize: 11, padding: "6px 9px", borderRadius: 11, boxShadow: "0 5px 14px rgba(0,0,0,.28)", border: "1.5px solid #FFE08A", width: 132, textAlign: "center", lineHeight: 1.3, ...bubblePos }}>
          {say}
        </div>
      )}
      <SeatBust who={who} size={50} active={active} />
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.35)", padding: "1px 7px", borderRadius: 999 }}>
        <span style={{ fontFamily: "'Noto Sans TC',sans-serif", fontSize: 11, fontWeight: 800, color: active ? "#FFD54A" : "#CDEBD9" }}>{seat.wind}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: "#EAFBF1" }}>{seat.name}</span>
        {thinking && <span style={{ display: "inline-flex", gap: 2 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 3.5, height: 3.5, borderRadius: "50%", background: "#FFD54A", animation: "ssthink 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />)}</span>}
      </div>
    </div>
  );
}

function Sim({ teacher, onExit }) {
  const T = useT();
  const [g, setG] = useState(null);
  const [tips, setTips] = useState(true);                    // tips highlight (suggested discard)
  const [hintsOn, setHintsOn] = useState(() => { try { return localStorage.getItem("ma.simTips") !== "0"; } catch (e) { return true; } }); // rotating glossary chip
  const [muted, setMuted] = useState(() => SOUND.isMuted());
  const [coach, setCoach] = useState(() => !lsLoad()?.simSeen);
  const [bubbles, setBubbles] = useState({});               // { seatIdx: text } — supports two bots conversing
  const [flash, setFlash] = useState(null);                  // {text, color} big call banner
  const [tipI, setTipI] = useState(() => Math.floor(Math.random() * SIM_TIPS.length));
  const [tipShow, setTipShow] = useState(true);
  const timer = useRef(null);
  const bubbleTimers = useRef({});
  const convoTimer = useRef(null);
  const flashTimer = useRef(null);

  const say = (seat, text, ms = 2600) => {
    if (!text) return;
    setBubbles((b) => ({ ...b, [seat]: text }));
    clearTimeout(bubbleTimers.current[seat]);
    bubbleTimers.current[seat] = setTimeout(() => setBubbles((b) => { const n = { ...b }; delete n[seat]; return n; }), ms);
  };
  const sayBot = (seat, kind) => say(seat, botLine(seat, kind));
  const doFlash = (text, color) => {
    setFlash({ text, color });
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1000);
  };

  // ---- init ----
  const start = () => {
    const wall = simWall();
    const hands = [[], [], [], []];
    for (let i = 0; i < 13; i++) for (let p = 0; p < 4; p++) hands[p].push(wall.pop());
    hands[0].push(wall.pop());
    setBubbles({}); setFlash(null);
    setG({
      wall, hands, melds: [[], [], [], []], pond: [],
      last: [null, null, null, null],
      cur: 0, phase: "myturn", wallLeft: wall.length,
      msg: "Your move — tap a tile to discard.",
      offer: null, over: null,
    });
  };
  useEffect(() => {
    start();
    return () => { clearTimeout(timer.current); Object.values(bubbleTimers.current).forEach(clearTimeout); clearTimeout(convoTimer.current); clearTimeout(flashTimer.current); SOUND.stopAmbience(); };
  }, []);

  // bot-to-bot banter: two random bots have a little exchange now and then
  useEffect(() => {
    const schedule = () => {
      convoTimer.current = setTimeout(() => {
        // pick two distinct bots (seats 1..3)
        const bots = [1, 2, 3].sort(() => Math.random() - 0.5);
        const [a, b] = bots;
        const ex = buildExchange();
        say(a, ex.open.replace("{n}", SEAT_INFO[b].name), 3000);
        setTimeout(() => say(b, ex.reply.replace("{n}", SEAT_INFO[a].name), 3000), 1500);
        schedule();
      }, 6000 + Math.random() * 7000);
    };
    schedule();
    return () => clearTimeout(convoTimer.current);
  }, []);

  // start parlor ambience once the coach is dismissed (needs a user gesture first)
  useEffect(() => { if (!coach && !muted) SOUND.startAmbience(); }, [coach, muted]);

  // rotate the glossary tip chip, fading seamlessly
  useEffect(() => {
    if (!hintsOn) return;
    const id = setInterval(() => {
      setTipShow(false);
      setTimeout(() => { setTipI((p) => (p + 1) % SIM_TIPS.length); setTipShow(true); }, 450);
    }, 6500);
    return () => clearInterval(id);
  }, [hintsOn]);

  const toggleMute = () => { const m = !muted; setMuted(m); SOUND.setMuted(m); if (!m) SOUND.startAmbience(); };
  const toggleHints = () => { const v = !hintsOn; setHintsOn(v); try { localStorage.setItem("ma.simTips", v ? "1" : "0"); } catch (e) {} };

  // ---- helpers ----
  const youWin = (g, fromSelf, fromSeat) => { SOUND.win(); doFlash(fromSelf ? "自摸!" : "食糊!", T.star); return { ...g, phase: "over", over: { winner: 0, self: fromSelf, from: fromSeat }, msg: fromSelf ? "自摸! You self-drew the win!" : "食糊! You won off the discard!" }; };
  const botWins = (g, p, fromSelf, fromSeat) => { SOUND.lose(); doFlash("食糊!", "#C0392B"); sayBot(p, "win"); return { ...g, phase: "over", over: { winner: p, self: fromSelf, from: fromSeat }, msg: `${SEAT_INFO[p].name} wins${fromSelf ? " (self-draw)" : ""}.` }; };

  // advance to a given player's draw (bot or you)
  const goDraw = (gg, p) => {
    if (gg.wall.length === 0) { setG({ ...gg, phase: "over", over: { winner: -1 }, msg: "Wall's empty — washout. Nobody wins this hand." }); return; }
    const wall = [...gg.wall];
    const drawn = wall.pop();
    const hands = gg.hands.map((h) => [...h]);
    hands[p].push(drawn);
    if (p === 0) {
      const selfWin = simIsWin(hands[0], gg.melds[0].length);
      setG({ ...gg, wall, hands, cur: 0, phase: "myturn", wallLeft: wall.length, drawn, msg: selfWin ? "You can declare 自摸!" : "You drew a tile — tap one to discard.", offer: selfWin ? { win: true } : null });
    } else {
      if (simIsWin(hands[p], gg.melds[p].length)) { setG(botWins({ ...gg, wall, hands }, p, true)); return; }
      const disc = simBotDiscard(hands[p]);
      hands[p].splice(hands[p].indexOf(disc), 1);
      SOUND.discard();
      if (Math.random() < 0.4) sayBot(p, "discard");
      afterDiscard({ ...gg, wall, hands }, p, disc);
    }
  };

  // resolve claims after a discard by player `from`
  const afterDiscard = (gg, from, tile) => {
    const pond = [...gg.pond, { t: tile, by: from }];
    const last = [...gg.last]; last[from] = tile;
    const base = { ...gg, pond, last, drawn: null };
    // 1) does any bot win on it? (in seat order)
    for (let o = 1; o <= 3; o++) {
      const p = (from + o) % 4;
      if (p !== 0 && simCanWinWith(base.hands[p], base.melds[p].length, tile)) { setG(botWins(base, p, false, from)); return; }
    }
    // 2) can YOU claim? (win > pung > chow). Chow only from your left = player 3.
    if (from !== 0) {
      const youCanWin = simCanWinWith(base.hands[0], base.melds[0].length, tile);
      const youCanPung = simCanPung(base.hands[0], tile);
      const youCanChow = from === 3 && simCanChow(base.hands[0], tile);
      if (youCanWin || youCanPung || youCanChow) {
        setG({ ...base, cur: from, phase: "claim", offer: { tile, from, win: youCanWin, pung: youCanPung, chow: youCanChow }, msg: `${SEAT_INFO[from].name} discarded — your call?` });
        return;
      }
    }
    // 3) nobody claims → next player draws
    const next = (from + 1) % 4;
    setG({ ...base, cur: next, phase: next === 0 ? "predraw" : "botthinking", offer: null, msg: next === 0 ? "Your turn." : `${SEAT_INFO[next].name} is thinking…` });
  };

  // ---- bot pacing ----
  useEffect(() => {
    if (!g) return;
    clearTimeout(timer.current);
    if (g.phase === "botthinking") {
      timer.current = setTimeout(() => goDraw(g, g.cur), 750);
    } else if (g.phase === "predraw") {
      timer.current = setTimeout(() => goDraw(g, 0), 450);
    }
    return () => clearTimeout(timer.current);
  }, [g?.phase, g?.cur]);

  // analyze hand for beginner coaching — runs every render (before early return).
  const handHint = useMemo(() => {
    if (!g || g.phase !== "myturn") return { keep: new Set(), worst: null, msg: null };
    return analyzeSimHand(g.hands[0]);
  }, [g]);
  const suggestKey = tips ? handHint.worst : null;

  if (!g) return null;

  const myHand = simSort(g.hands[0]);
  const myMelds = g.melds[0];

  // your discard
  const discard = (tk, idx) => {
    if (g.phase !== "myturn") return;
    SOUND.discard();
    const hands = g.hands.map((h) => [...h]);
    // remove one instance by key
    const pos = hands[0].indexOf(tk);
    hands[0].splice(pos, 1);
    afterDiscard({ ...g, hands, offer: null }, 0, tk);
  };

  // claim actions
  const doWin = () => {
    if (g.offer?.win && g.phase === "claim") setG(youWin({ ...g, hands: g.hands.map(h=>[...h]), hands0add: g.offer.tile }, false, g.offer.from));
    else if (g.phase === "myturn" && g.offer?.win) setG(youWin(g, true));
  };
  const doPung = () => {
    const tile = g.offer.tile, from = g.offer.from;
    SOUND.claim(); doFlash("碰!", T.primary); sayBot(from, "youPung");
    const hands = g.hands.map((h) => [...h]);
    let removed = 0;
    hands[0] = hands[0].filter((k) => { if (k === tile && removed < 2) { removed++; return false; } return true; });
    const melds = g.melds.map((m) => [...m]);
    melds[0] = [...melds[0], { type: "pung", tiles: [tile, tile, tile] }];
    setG({ ...g, hands, melds, phase: "myturn", offer: null, cur: 0, msg: "碰! Pung taken — now discard." });
  };
  const doChow = () => {
    const tile = g.offer.tile, s = tile[0], n = +tile.slice(1);
    SOUND.claim(); doFlash("上!", T.primary);
    const hands = g.hands.map((h) => [...h]);
    const combos = [[-2,-1],[-1,1],[1,2]];
    let used = null;
    for (const [a,b] of combos) { const ka=s+(n+a), kb=s+(n+b); if (hands[0].includes(ka)&&hands[0].includes(kb)){ used=[ka,kb]; break; } }
    if (used) { hands[0].splice(hands[0].indexOf(used[0]),1); hands[0].splice(hands[0].indexOf(used[1]),1); }
    const melds = g.melds.map((m) => [...m]);
    melds[0] = [...melds[0], { type: "chow", tiles: simSort([tile, ...used]) }];
    setG({ ...g, hands, melds, phase: "myturn", offer: null, cur: 0, msg: "上! Chow taken — now discard." });
  };
  const pass = () => {
    const from = g.offer.from;
    const next = (from + 1) % 4;
    setG({ ...g, offer: null, cur: next, phase: next === 0 ? "predraw" : "botthinking", msg: next === 0 ? "Your turn." : `${SEAT_INFO[next].name} is thinking…` });
  };

  const over = g.over;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "min(100dvh,840px)", padding: "12px 14px calc(14px + env(safe-area-inset-bottom,0px))" }}>
      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button onClick={onExit} aria-label="Exit game" style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, width: 40, height: 40, fontSize: 16, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow }}>✕</button>
        <div style={{ flex: 1, fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 15.5, color: T.ink }}>Practice Table <span style={{ color: T.sub, fontWeight: 700, fontSize: 12.5 }}>· wall {g.wallLeft ?? g.wall.length}</span></div>
        <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 999, width: 38, height: 38, fontSize: 16, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow }}>{muted ? "🔇" : "🔊"}</button>
        <button onClick={() => setTips((v) => !v)} style={{ background: tips ? T.primary : T.card, color: tips ? "#fff" : T.sub, border: `1.5px solid ${tips ? T.primary : T.cardBorder}`, borderRadius: 999, padding: "7px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", boxShadow: T.chipShadow }}>Hints {tips ? "on" : "off"}</button>
      </div>

      {/* table — arcade cabinet screen */}
      <div style={{ flex: 1, position: "relative", borderRadius: 22, padding: 4, background: "linear-gradient(135deg, #FF4D8D, #C9920F 40%, #34D0FF)", boxShadow: `0 0 22px ${T.neonPink}55, 0 6px 0 rgba(0,0,0,.25)` }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxWidth: 440, margin: "0 auto", background: "radial-gradient(120% 120% at 50% 45%, #1F7A55 0%, #16603F 60%, #0E4329 100%)", borderRadius: 18, boxShadow: "inset 0 2px 18px rgba(0,0,0,.45)", overflow: "hidden" }}>
        {/* CRT scanlines */}
        <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(0,0,0,.10) 0px, rgba(0,0,0,.10) 1px, transparent 2px, transparent 4px)", pointerEvents: "none", opacity: .5 }} />
        {/* inset felt square outline (the playing surface) */}
        <div style={{ position: "absolute", inset: "16%", border: "2px dashed rgba(255,255,255,.14)", borderRadius: 10 }} />

        {/* seats on the four edges */}
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }}>
          <Seat seatIdx={2} seat={SEAT_INFO[2]} count={g.hands[2].length} active={g.cur === 2} say={bubbles[2]} thinking={g.cur === 2 && g.phase === "botthinking"} side="top" />
        </div>
        <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)" }}>
          <Seat seatIdx={3} seat={SEAT_INFO[3]} count={g.hands[3].length} active={g.cur === 3} say={bubbles[3]} thinking={g.cur === 3 && g.phase === "botthinking"} side="left" />
        </div>
        <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }}>
          <Seat seatIdx={1} seat={SEAT_INFO[1]} count={g.hands[1].length} active={g.cur === 1} say={bubbles[1]} thinking={g.cur === 1 && g.phase === "botthinking"} side="right" />
        </div>
        <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)" }}>
          <Seat seatIdx={0} seat={SEAT_INFO[0]} count={g.hands[0].length} active={g.cur === 0} say={bubbles[0]} thinking={false} side="bottom" />
        </div>

        {/* center: discard pond */}
        <div style={{ position: "absolute", inset: "26%", display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 2 }}>
          {g.pond.slice(-16).map((d, i, arr) => (
            <div key={g.pond.length - arr.length + i} className={i === arr.length - 1 ? "ss-land2" : ""} style={{ transform: "scale(.7)", margin: -3 }}><MiniTile t={simFromKey(d.t)} size={30} /></div>
          ))}
        </div>

        {/* big call flash */}
        {flash && (
          <div className="ss-flash" style={{ position: "absolute", inset: 0, zIndex: 12, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontFamily: "'Noto Sans TC',sans-serif", fontWeight: 800, fontSize: 80, color: flash.color, textShadow: `0 0 18px ${flash.color}, 0 4px 18px rgba(0,0,0,.6)`, WebkitTextStroke: "2px #fff" }}>{flash.text}</div>
          </div>
        )}
      </div>
      </div>

      {/* message line */}
      <div style={{ textAlign: "center", color: T.ink, fontWeight: 800, fontSize: 14, minHeight: 20, marginTop: 8, fontFamily: T.fontDisplay }}>{g.msg}</div>

      {/* beginner coach: what to keep & collect (when it's your turn + hints on) */}
      {tips && g.phase === "myturn" && handHint.msg && (
        <div className="ss-tipfade" style={{ marginTop: 8, display: "flex", alignItems: "flex-start", gap: 9, background: "linear-gradient(180deg, #2A1840, #1F1330)", border: `1.5px solid ${T.neonPink}`, borderRadius: 13, padding: "10px 13px", boxShadow: `0 0 18px ${T.neonPink}44` }}>
          <span style={{ fontSize: 16 }}>🧧</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#FCEFF5", lineHeight: 1.4 }}>{handHint.msg}</span>
        </div>
      )}

      {/* rotating glossary tip — non-intrusive, fades, dismissible */}
      {hintsOn && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 12, padding: "8px 11px", boxShadow: T.chipShadow }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span key={tipI} className={tipShow ? "ss-tipfade" : ""} style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: T.sub, lineHeight: 1.35, opacity: tipShow ? 1 : 0, transition: "opacity .4s ease" }}>{SIM_TIPS[tipI]}</span>
          <button onClick={toggleHints} aria-label="Dismiss tips" style={{ background: "none", border: "none", color: T.sub, fontSize: 15, cursor: "pointer", padding: 2, lineHeight: 1, opacity: .7 }}>✕</button>
        </div>
      )}

      {/* your melds */}
      {myMelds.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {myMelds.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 1, background: "rgba(0,0,0,.05)", borderRadius: 7, padding: 3 }}>
              {m.tiles.map((t, j) => <MiniTile key={j} t={simFromKey(t)} size={28} />)}
            </div>
          ))}
        </div>
      )}

      {/* your hand — wraps to 2 rows so the WHOLE hand is visible; sized for thumbs */}
      <div style={{ marginTop: 8, background: "linear-gradient(180deg, #14110C, #221A10)", borderRadius: 18, border: "2px solid #C9920F", padding: "8px 6px 12px", boxShadow: "0 4px 0 #6E4F08, inset 0 1px 0 rgba(255,210,120,.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "2px 8px 8px" }}>
          <span style={{ width: 24, height: 24, borderRadius: "50%", background: g.cur === 0 ? T.star : "rgba(255,255,255,.12)", border: `2px solid ${g.cur === 0 ? T.star : "rgba(255,255,255,.25)"}`, color: g.cur === 0 ? "#1A1230" : "#FFE08A", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans TC',sans-serif" }}>東</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#FFE08A", letterSpacing: ".04em", textTransform: "uppercase" }}>Your Hand</span>
          {g.phase === "myturn" && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#9C7B3A" }}>· tap a tile to throw</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, rowGap: 8, justifyContent: "center", padding: "2px 4px" }}>
          {myHand.map((tk, i) => {
            const isDrawn = tk === g.drawn && g.phase === "myturn";
            const suggested = tk === suggestKey;
            const keep = tips && g.phase === "myturn" && handHint.keep.has(tk) && !suggested;
            // size so 7 tiles fit per row (→ two rows for a 13–14 tile hand), clamped for thumbs
            const W = typeof window !== "undefined" ? Math.min(window.innerWidth, 460) : 400;
            const sz = Math.max(38, Math.min(52, Math.floor((W - 52 - 6 * 6) / 7)));
            return (
              <button key={i} onClick={() => discard(tk, i)} disabled={g.phase !== "myturn"}
                className="ss-deal" style={{
                  flex: "0 0 auto", border: "none", background: "none", padding: 0, cursor: g.phase === "myturn" ? "pointer" : "default",
                  borderRadius: 11, animationDelay: `${i * 16}ms`, position: "relative",
                  transform: isDrawn ? "translateY(-4px)" : "none",
                  boxShadow: suggested ? `0 0 0 3px ${T.neonPink}, 0 0 12px ${T.neonPink}` : keep ? `0 0 0 3px #2FD08A, 0 0 9px #2FD08A88` : isDrawn ? `0 0 0 3px ${T.star}` : "none",
                  WebkitTapHighlightColor: "transparent",
                }}>
                <MiniTile t={simFromKey(tk)} size={sz} />
                {suggested && <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 14 }}>👎</span>}
              </button>
            );
          })}
        </div>
        {tips && g.phase === "myturn" && (
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 8, fontSize: 10.5, fontWeight: 700, color: "#9C7B3A" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "#2FD08A" }} /> keep / collecting</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: T.neonPink }} /> safe to throw</span>
          </div>
        )}
      </div>

      {/* action bar */}
      {g.phase === "claim" && g.offer && (
        <div className="ss-sheet" style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {g.offer.win && <button onClick={() => setG(youWin(g, false, g.offer.from))} className="ss-btn" style={{ flex: 1, minHeight: 52, fontWeight: 800, fontSize: 16, color: "#fff", background: T.star, border: "none", borderRadius: 14, boxShadow: `0 4px 0 #C99200`, cursor: "pointer", fontFamily: T.fontBody }}>食糊!</button>}
          {g.offer.pung && <button onClick={doPung} className="ss-btn" style={{ flex: 1, minHeight: 52, fontWeight: 800, fontSize: 16, color: "#fff", background: T.primary, border: "none", borderRadius: 14, boxShadow: `0 4px 0 ${T.primaryDeep}`, cursor: "pointer", fontFamily: T.fontBody }}>碰 Pung</button>}
          {g.offer.chow && <button onClick={doChow} className="ss-btn" style={{ flex: 1, minHeight: 52, fontWeight: 800, fontSize: 16, color: T.ink, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 14, boxShadow: T.cardShadow, cursor: "pointer", fontFamily: T.fontBody }}>上 Chow</button>}
          <button onClick={pass} style={{ flex: 1, minHeight: 52, fontWeight: 800, fontSize: 16, color: T.sub, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 14, boxShadow: T.cardShadow, cursor: "pointer", fontFamily: T.fontBody }}>Pass</button>
        </div>
      )}
      {g.phase === "myturn" && g.offer?.win && (
        <div className="ss-sheet" style={{ marginTop: 12 }}>
          <button onClick={() => setG(youWin(g, true))} className="ss-btn" style={{ width: "100%", minHeight: 54, fontWeight: 800, fontSize: 17, color: "#fff", background: T.star, border: "none", borderRadius: 16, boxShadow: `0 4px 0 #C99200`, cursor: "pointer", fontFamily: T.fontBody }}>自摸! Declare self-draw win</button>
        </div>
      )}

      {/* first-time coach */}
      {coach && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,14,26,.6)", backdropFilter: "blur(4px)", padding: 24 }}>
          <div style={{ width: "min(400px,100%)", background: T.surface, borderRadius: 24, padding: "26px 22px", textAlign: "left", boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
            <div style={{ textAlign: "center", fontSize: 40 }}>🀄</div>
            <h2 style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 21, color: T.ink, margin: "8px 0 14px", textAlign: "center" }}>How a hand works</h2>
            {[
              ["1", "Your turn", "You're dealt a tile automatically — then tap one in your hand to discard it."],
              ["2", "Claim discards", "When a bot throws a tile you can use, 碰 Pung / 上 Chow / 食糊 buttons pop up. Grab it or Pass."],
              ["3", "Meld & win", "Claimed tiles form a set in front of you. Complete 4 sets + a pair (the eyes) and declare 食糊!"],
              ["⚠", "Defend", "Bots can win off your discards. When someone looks close, throw safe tiles."],
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: i === 3 ? T.dangerSoft : T.primarySoft || T.successSoft, color: i === 3 ? T.danger : T.primary, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{r[0]}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: T.ink, fontFamily: T.fontDisplay }}>{r[1]}</div>
                  <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.45, marginTop: 1 }}>{r[2]}</div>
                </div>
              </div>
            ))}
            <Btn onClick={() => { setCoach(false); lsSave({ ...(lsLoad() || {}), simSeen: true }); }}>Got it — let's play</Btn>
          </div>
        </div>
      )}

      {/* game over */}
      {g.phase === "over" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,14,26,.6)", backdropFilter: "blur(4px)", padding: 24 }}>
          {over.winner === 0 && <Confetti />}
          <div style={{ position: "relative", width: "min(420px,100%)", background: T.surface, borderRadius: 26, padding: "30px 24px", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
            <div style={{ fontSize: 52 }}>{over.winner === 0 ? "🏆" : over.winner === -1 ? "🀄" : "🙇"}</div>
            <h2 style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 24, color: T.ink, margin: "10px 0 6px" }}>
              {over.winner === 0 ? (over.self ? "自摸! You win!" : "食糊! You win!") : over.winner === -1 ? "Washout" : `${SEAT_INFO[over.winner].name} wins`}
            </h2>
            <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.5, margin: "0 0 20px" }}>
              {over.winner === 0 ? "You assembled 4 sets and a pair — that's a real Hong Kong mahjong win. Nicely played." :
               over.winner === -1 ? "The wall ran out before anyone completed a hand. It happens — deal again." :
               over.from === 0 ? "They won off your discard (出銃). Watch what you throw when someone looks close." :
               "They completed their hand first. Study the pond and try again."}
            </p>
            <Btn onClick={start}>Deal again</Btn>
            <button onClick={onExit} style={{ width: "100%", marginTop: 10, minHeight: 48, fontWeight: 800, fontSize: 15.5, color: T.sub, background: "transparent", border: "none", cursor: "pointer" }}>Leave table</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- PRACTICE: Memory Match ---------------- */

function MemoryGame({ teacher, onExit }) {
  const T = useT();
  const pool = useMemo(() => [
    { s: "dots", n: 5 }, { s: "bamboo", n: 3 }, { s: "char", n: 7 },
    { s: "wind", c: "東" }, { s: "wind", c: "北" },
    { s: "dragon", d: "r" }, { s: "dragon", d: "g" },
    { s: "flower", c: "春", col: SUIT.green },
  ], []);
  const keyOf = (t) => t.s === "dots" ? "o" + t.n : t.s === "bamboo" ? "b" + t.n : t.s === "char" ? "k" + t.n : t.s === "wind" ? "w" + t.c : t.s === "dragon" ? "z" + t.d : "f" + t.c;

  const deal = () => {
    const cards = [];
    pool.forEach((t, i) => { cards.push({ id: i + "a", k: keyOf(t), t }); cards.push({ id: i + "b", k: keyOf(t), t }); });
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return cards;
  };
  const [cards, setCards] = useState(deal);
  const [flipped, setFlipped] = useState([]);    // indices currently face up (max 2)
  const [matched, setMatched] = useState([]);     // matched card ids
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const won = matched.length === cards.length;

  const restart = () => { setCards(deal()); setFlipped([]); setMatched([]); setMoves(0); setLocked(false); };

  const tap = (i) => {
    if (locked || flipped.includes(i) || matched.includes(cards[i].id)) return;
    clack();
    const f = [...flipped, i];
    setFlipped(f);
    if (f.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = f;
      if (cards[a].k === cards[b].k) {
        setMatched((m) => [...m, cards[a].id, cards[b].id]);
        setFlipped([]);
      } else {
        setLocked(true);
        setTimeout(() => { setFlipped([]); setLocked(false); }, 850);
      }
    }
  };

  return (
    <div style={{ padding: "0 18px 30px", minHeight: "min(100dvh,820px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0 8px" }}>
        <button onClick={onExit} aria-label="Back" style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, width: 46, height: 46, fontSize: 18, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow }}>‹</button>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.ink, margin: 0, flex: 1 }}>Memory Match</h2>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.sub, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 999, padding: "7px 13px", boxShadow: T.chipShadow }}>{matched.length / 2}/{pool.length}</div>
      </div>
      <p style={{ fontSize: 14, color: T.sub, margin: "0 0 14px", lineHeight: 1.5 }}>Flip two tiles to find matching pairs — and drill your tile recognition across suits, honors, and flowers. Fewer moves is better.</p>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxWidth: 320, margin: "0 auto", width: "100%" }}>
          {cards.map((c, i) => {
            const faceUp = flipped.includes(i) || matched.includes(c.id);
            const isMatched = matched.includes(c.id);
            return (
              <button key={c.id} onClick={() => tap(i)}
                style={{ aspectRatio: "0.78", border: "none", background: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent", opacity: isMatched ? 0.55 : 1, transition: "opacity .3s ease" }}>
                <div className={faceUp ? "ss-pop" : ""} style={{ width: "100%", height: "100%" }}>
                  {faceUp
                    ? <div style={{ width: "100%", height: "100%", background: TILE.face, border: `1.5px solid ${isMatched ? T.success : TILE.edge}`, borderRadius: 11, boxShadow: `0 4px 0 ${TILE.shadow}${isMatched ? `, 0 0 0 2.5px ${T.success}` : ""}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg viewBox="0 0 60 80" width="74%" height="74%"><TileFace t={c.t} /></svg>
                      </div>
                    : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#3FA877,#2E8C60)", border: "1.5px solid #246E4B", borderRadius: 11, boxShadow: "0 4px 0 #1F6B49", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "52%", height: "52%", borderRadius: 6, border: "1.5px solid rgba(255,255,255,.35)" }} />
                      </div>}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, fontWeight: 800, color: T.sub }}>Moves: {moves}</div>
      </div>

      {won && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,14,26,.55)", backdropFilter: "blur(4px)", padding: 24 }}>
          <Confetti />
          <div style={{ position: "relative", width: "min(380px,100%)", background: T.surface, borderRadius: 24, padding: "28px 24px", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,.4)" }}>
            <div style={{ fontSize: 46 }}>🧠</div>
            <h2 style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 23, color: T.ink, margin: "8px 0 6px" }}>All matched!</h2>
            <p style={{ fontSize: 14.5, color: T.sub, margin: "0 0 18px" }}>Cleared in <b style={{ color: T.ink }}>{moves}</b> moves. Sharp eyes — that's the tile-recognition that keeps you fast at a real table.</p>
            <Btn onClick={restart}>Play again</Btn>
            <button onClick={onExit} style={{ width: "100%", marginTop: 10, minHeight: 46, fontWeight: 800, fontSize: 15, color: T.sub, background: "transparent", border: "none", cursor: "pointer" }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- PRACTICE: How to Win (anatomy + eyes + scoring) ---------------- */

function WinAnatomy({ teacher, onExit }) {
  const T = useT();
  const sets = [
    { kind: "Chow", cn: "上", tiles: [D(2), D(3), D(4)], note: "Three in a row, same suit.", fan: null },
    { kind: "Pung", cn: "碰", tiles: [Dr("r"), Dr("r"), Dr("r")], note: "A dragon triplet — scores fan!", fan: "Red dragon +1番" },
    { kind: "Chow", cn: "上", tiles: [B(6), B(7), B(8)], note: "Another run, in Bamboo.", fan: null },
    { kind: "Pung", cn: "碰", tiles: [W("南"), W("南"), W("南")], note: "Your seat wind (South) — scores!", fan: "Seat wind +1番" },
    { kind: "Eyes", cn: "眼", tiles: [Ch(5), Ch(5)], note: "The pair — called the “eyes” 眼 (ngaan). Every hand needs exactly one.", fan: null },
  ];
  const [open, setOpen] = useState(null);
  const [declared, setDeclared] = useState(false);

  return (
    <div style={{ padding: "0 18px 30px", minHeight: "min(100dvh,820px)", display: "flex", flexDirection: "column", position: "relative" }}>
      {declared && <Confetti />}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0 8px" }}>
        <button onClick={onExit} aria-label="Back" style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, width: 46, height: 46, fontSize: 18, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow }}>‹</button>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.ink, margin: 0 }}>Anatomy of a Win</h2>
      </div>
      <p style={{ fontSize: 14.5, color: T.sub, margin: "0 0 14px", lineHeight: 1.5 }}>
        A winning hand is always <b>4 sets + the eyes</b> (a pair) = 14 tiles. Tap each piece to see what it is — then declare 食糊.
      </p>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, justifyContent: "center" }}>
        {sets.map((s, i) => {
          const isOpen = open === i;
          const isEyes = s.kind === "Eyes";
          return (
            <button key={i} onClick={() => { clack(); setOpen(isOpen ? null : i); }}
              style={{ textAlign: "left", background: T.card, border: `1.5px solid ${isOpen ? (isEyes ? T.star : T.primary) : T.cardBorder}`, borderRadius: 16, padding: "11px 13px", boxShadow: isOpen ? `0 0 0 2px ${isEyes ? T.star : T.primary}, ${T.cardShadow}` : T.cardShadow, cursor: "pointer", WebkitTapHighlightColor: "transparent", transition: "box-shadow .15s ease, border-color .15s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 2 }}>{s.tiles.map((t, j) => <MiniTile key={j} t={t} size={38} />)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: T.ink, fontFamily: T.fontDisplay }}>
                    {s.kind} <span style={{ fontFamily: "'Noto Sans TC',sans-serif", color: isEyes ? T.starText : T.primary }}>{s.cn}</span>
                  </div>
                  {s.fan && <div style={{ fontSize: 12, fontWeight: 800, color: T.successDeep }}>{s.fan}</div>}
                </div>
                <span style={{ color: T.sub, fontSize: 18, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}>›</span>
              </div>
              {isOpen && <div style={{ fontSize: 13.5, color: T.sub, marginTop: 9, lineHeight: 1.5, paddingLeft: 2 }}>{s.note}</div>}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        {!declared ? (
          <Btn onClick={() => { setDeclared(true); }} tone="success">🀄 Declare 食糊!</Btn>
        ) : (
          <div className="ss-sheet" style={{ background: T.successSoft, border: `1.5px solid ${T.success}55`, borderRadius: 16, padding: "14px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: T.successDeep, fontFamily: T.fontDisplay, marginBottom: 8 }}>食糊! You declared a win 🎉</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13.5, color: T.ink }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Red dragon pung</span><b>+1 番</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Seat wind (South) pung</span><b>+1 番</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Winning the hand</span><b>+1 番</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.success}44`, paddingTop: 5, marginTop: 2, fontWeight: 800, color: T.successDeep }}><span>Total</span><span>3 番 — meets the minimum ✓</span></div>
            </div>
            <p style={{ fontSize: 12.5, color: T.sub, marginTop: 8, lineHeight: 1.45 }}>Lay your hand face-up, count your fan, collect. That's a complete Hong Kong win.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= ENDLESS PRACTICE: drill generators ================= */
/* Each generator returns a fresh, randomized drill compatible with the
   existing Lesson renderers — so replays are never identical. Win-hand
   generation reuses the validated sim engine (simKey / simIsWin). */

const SUITS3 = ["dots", "bamboo", "char"];
const SUIT_NAME = { dots: "Dots", bamboo: "Bamboo", char: "Characters" };
const HONOR_POOL = [W("東"), W("南"), W("西"), W("北"), Dr("r"), Dr("g"), Dr("w")];
const ri = (n) => Math.floor(Math.random() * n);
const pickOne = (a) => a[ri(a.length)];
const shuf = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const randSuitTile = () => ({ s: pickOne(SUITS3), n: 1 + ri(9) });
const randTile = () => (Math.random() < 0.76 ? randSuitTile() : pickOne(HONOR_POOL));
const sameT = (a, b) => simKey(a) === simKey(b);
const diffTile = (t, ex = []) => { let x, g = 0; do { x = randTile(); g++; } while ((sameT(x, t) || ex.some((e) => sameT(x, e))) && g < 60); return x; };
const honorName = (t) => t.s === "wind" ? ({ "東": "East wind", "南": "South wind", "西": "West wind", "北": "North wind" })[t.c] : ({ r: "Red dragon", g: "Green dragon", w: "White dragon" })[t.d];
const suitHint = (s) => s === "dots" ? "circles" : s === "bamboo" ? "sticks (and the bird at 1)" : "萬 characters";

function genIdSuit() {
  const target = pickOne(SUITS3);
  const correctTile = { s: target, n: 1 + ri(9) };
  const others = shuf(SUITS3.filter((s) => s !== target)).slice(0, 2).map((s) => ({ s, n: 1 + ri(9) }));
  const tiles = shuf([correctTile, ...others]);
  return { type: "pickOne", prompt: `Tap a ${SUIT_NAME[target]} tile`, tiles, correct: tiles.indexOf(correctTile), hint: `${SUIT_NAME[target]} = ${suitHint(target)}.` };
}
function genFindSuit() {
  const target = pickOne(SUITS3);
  const k = 2 + ri(2);
  const targets = Array.from({ length: k }, () => ({ s: target, n: 1 + ri(9) }));
  const others = [];
  while (targets.length + others.length < 6) { const t = randTile(); if (t.s !== target) others.push(t); }
  const tiles = shuf([...targets, ...others]);
  const correct = tiles.map((t, i) => (t.s === target ? i : -1)).filter((i) => i >= 0);
  return { type: "pickMany", prompt: `Tap all the ${SUIT_NAME[target]} tiles`, tiles, correct, hint: `${SUIT_NAME[target]} show ${suitHint(target)}.` };
}
function genReadNumber() {
  const s = pickOne(SUITS3), n = 1 + ri(9);
  const opts = shuf([n, ...shuf([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== n)).slice(0, 2)]);
  return { type: "pickOne", big: true, tiles: [{ s, n }], choices: opts.map(String), correct: opts.indexOf(n), prompt: `What number is this ${SUIT_NAME[s]} tile?`, hint: s === "char" ? "Read the character on top." : "Count the marks." };
}
function genHonorId() {
  const target = pickOne(HONOR_POOL);
  const nm = honorName(target);
  const others = shuf(HONOR_POOL.filter((h) => honorName(h) !== nm)).slice(0, 2);
  const tiles = shuf([target, ...others]);
  return { type: "pickOne", prompt: `Which tile is the ${nm}?`, tiles, correct: tiles.indexOf(target), hint: `Look for ${target.s === "wind" ? target.c : target.d === "r" ? "中" : target.d === "g" ? "發" : "the blank frame"}.` };
}
function genIsHonor() {
  const k = 2 + ri(2);
  const honors = shuf(HONOR_POOL).slice(0, k);
  const rest = [];
  while (honors.length + rest.length < 6) rest.push(randSuitTile());
  const tiles = shuf([...honors, ...rest]);
  const correct = tiles.map((t, i) => (t.s === "wind" || t.s === "dragon" ? i : -1)).filter((i) => i >= 0);
  return { type: "pickMany", prompt: "Tap all the honor tiles", tiles, correct, hint: "Honors = winds & dragons (no numbers)." };
}
function genCompletePung() {
  const t = randTile();
  const w1 = diffTile(t), w2 = diffTile(t, [w1]);
  const opts = shuf([t, w1, w2]);
  return { type: "pickOne", prompt: "Complete the Pung", context: [t, t, "gap"], tiles: opts, correct: opts.indexOf(t), hint: "A pung is three identical tiles — same suit, same number." };
}
function genCompleteChow() {
  const s = pickOne(SUITS3), n = 1 + ri(7);
  const run = [{ s, n }, { s, n: n + 1 }, { s, n: n + 2 }];
  const miss = ri(3);
  const ans = run[miss];
  const context = run.map((t, i) => (i === miss ? "gap" : t));
  let alt = ans.n + (Math.random() < 0.5 ? 1 : -1); if (alt < 1) alt = ans.n + 2; if (alt > 9) alt = ans.n - 2;
  const w1 = { s, n: alt };
  const w2 = { s: pickOne(SUITS3.filter((x) => x !== s)), n: ans.n };
  const opts = shuf([ans, w1, w2]);
  return { type: "pickOne", prompt: "Fill the gap in this Chow", context, tiles: opts, correct: opts.indexOf(ans), hint: "Same suit, consecutive numbers." };
}
function genPickSet() {
  const want = pickOne(["Pung", "Chow", "Pair"]);
  const mk = {
    Pung: () => { const t = randTile(); return [t, t, t]; },
    Chow: () => { const s = pickOne(SUITS3), n = 1 + ri(7); return [{ s, n }, { s, n: n + 1 }, { s, n: n + 2 }]; },
    Pair: () => { const t = randTile(); return [t, t]; },
  };
  const others = ["Pung", "Chow", "Pair"].filter((x) => x !== want);
  const options = shuf([{ tiles: mk[want]() }, { tiles: mk[others[0]]() }, { tiles: mk[others[1]]() }]);
  const correct = options.findIndex((o) => o.tiles === options.find((x) => x.tiles.length === (want === "Pair" ? 2 : 3) && (want !== "Chow" ? simKey(x.tiles[0]) === simKey(x.tiles[1]) : simKey(x.tiles[0]) !== simKey(x.tiles[1]))).tiles);
  // robust correct: the option whose shape matches `want`
  const isPung = (ts) => ts.length === 3 && ts.every((t) => simKey(t) === simKey(ts[0]));
  const isPair = (ts) => ts.length === 2 && simKey(ts[0]) === simKey(ts[1]);
  const isChow = (ts) => ts.length === 3 && !isPung(ts);
  const matcher = want === "Pung" ? isPung : want === "Pair" ? isPair : isChow;
  const ci = options.findIndex((o) => matcher(o.tiles));
  return { type: "pickSet", prompt: `Tap the ${want}`, options, correct: ci, hint: want === "Pung" ? "Three identical tiles." : want === "Chow" ? "Three consecutive, same suit." : "Two identical tiles." };
}
function genDiscard() {
  const s = pickOne(SUITS3), n = 2 + ri(5);
  const pt = randSuitTile();
  const chow = [{ s, n }, { s, n: n + 1 }];
  const pair = [pt, pt];
  const lone = pickOne(HONOR_POOL);
  const tiles = shuf([...chow, ...pair, lone]);
  return { type: "pickOne", prompt: "Tap the best tile to discard", tiles, correct: tiles.indexOf(lone), hint: "The lone tile with no pair and no neighbours is worth the least — throw it." };
}
function genSpeedCall() {
  const t = randTile();
  return { type: "speed", prompt: "Lightning round!", say: () => <>An opponent discards this — and you're holding <b>two</b> of them. React before the timer runs out.</>, tile: t, seconds: 4, choices: ["碰 Pung!", "上 Chow", "Pass"], correct: 0, hint: "You hold the pair — Pung, fast!" };
}
function genWinGroups() {
  for (let a = 0; a < 60; a++) {
    const counts = {}; const groups = [];
    const tryAdd = (tiles) => {
      const tmp = { ...counts };
      for (const t of tiles) { const k = simKey(t); tmp[k] = (tmp[k] || 0) + 1; if (tmp[k] > 4) return false; }
      Object.assign(counts, tmp); groups.push(tiles); return true;
    };
    let ok = true;
    for (let i = 0; i < 4; i++) {
      let placed = false;
      for (let tr = 0; tr < 25 && !placed; tr++) {
        if (Math.random() < 0.5) { const t = randTile(); placed = tryAdd([t, t, t]); }
        else { const s = pickOne(SUITS3), n = 1 + ri(7); placed = tryAdd([{ s, n }, { s, n: n + 1 }, { s, n: n + 2 }]); }
      }
      if (!placed) { ok = false; break; }
    }
    if (!ok) continue;
    let paired = false;
    for (let tr = 0; tr < 25 && !paired; tr++) { const t = randTile(); paired = tryAdd([t, t]); }
    if (!paired) continue;
    if (simIsWin(groups.flat().map(simKey), 0)) return groups;
  }
  return [[D(1), D(2), D(3)], [B(5), B(5), B(5)], [Ch(7), Ch(8), Ch(9)], [W("東"), W("東"), W("東")], [Dr("r"), Dr("r")]];
}
function breakHand(groups) {
  for (let a = 0; a < 30; a++) {
    const gi = ri(groups.length), g = [...groups[gi]], ti = ri(g.length), repl = diffTile(g[ti]);
    const ng = groups.map((x, i) => (i === gi ? g.map((t, j) => (j === ti ? repl : t)) : x));
    if (!simIsWin(ng.flat().map(simKey), 0)) return ng;
  }
  const ng = groups.map((x) => [...x]); ng[ng.length - 1][0] = diffTile(ng[ng.length - 1][1]); return ng;
}
function genJudgeWin() {
  const win = Math.random() < 0.5;
  let groups = genWinGroups();
  if (!win) groups = breakHand(groups);
  return { type: "judge", prompt: "Is this a winning hand?", groups: groups.map((g) => ({ tiles: g })), choices: ["食糊 — it's a win!", "Not yet"], correct: win ? 0 : 1, hint: win ? "4 sets + a pair (the eyes 眼). That's a win." : "A set or the pair is incomplete — count again." };
}

// rotating facts — each teaches something new about an elementary aspect
const FACTS = [
  { title: "The bird tile", tiles: [B(1)], cap: ["1 of Bamboo"], body: <>The <b>1 of Bamboo</b> shows a bird, not a stick — and the game itself is named after it. <b>麻雀</b> means “sparrow.”</> },
  { title: "Why 萬?", tiles: [Ch(5)], cap: ["5 of Characters"], body: <>The red <b>萬</b> on every Character tile means <b>ten-thousand</b>. The suit is literally the “ten-thousands.”</> },
  { title: "Green = get rich", tiles: [Dr("g")], cap: ["Green dragon"], body: <>The green dragon is <b>發 (faat)</b> — “to prosper / strike it rich.” No surprise gamblers chase it.</> },
  { title: "The shy dragon", tiles: [Dr("w")], cap: ["White dragon"], body: <>The <b>white dragon</b> is a blank (or a plain 白 frame) — the tile that “forgot to get dressed.”</> },
  { title: "Coins & strings", tiles: [D(1), B(9)], cap: ["Dots", "Bamboo"], body: <>The suits come from old money: <b>Dots</b> are coins, <b>Bamboo</b> are strings of coins, <b>Characters</b> are ten-thousands of them.</> },
  { title: "Winds are seats", tiles: [W("東")], cap: ["East"], body: <>Each wind is a <b>seat</b>: 東 South 西 North, going counter-clockwise. <b>East is the dealer</b> — and plays for double.</> },
  { title: "The eyes 眼", tiles: [Ch(3), Ch(3)], cap: ["A pair"], body: <>Every winning hand needs exactly one pair — the Cantonese call it the <b>“eyes” 眼 (ngaan)</b>. Four sets, and the eyes.</> },
  { title: "144 in a set", tiles: [Fl("春", SUIT.green)], cap: ["Spring (a flower)"], body: <>A full set is <b>144</b> tiles: 108 suits, 16 winds, 12 dragons, and <b>8 flowers</b> — the free bonus tiles.</> },
];
function genFact() {
  const f = pickOne(FACTS);
  return { type: "teach", title: f.title, say: () => f.body, tiles: f.tiles, captions: f.cap, requireAll: false, note: "💡 Did you know?" };
}

const GEN_POOLS = {
  recognition: [genIdSuit, genFindSuit, genReadNumber, genHonorId, genIsHonor],
  sets: [genPickSet, genCompletePung, genCompleteChow],
  winning: [genJudgeWin, genJudgeWin, genPickSet],
  discards: [genDiscard, genSpeedCall],
  // freshly-generated drills that mirror each unit's curriculum
  unit1: [genIdSuit, genFindSuit, genReadNumber, genHonorId, genIsHonor, genCompletePung, genCompleteChow, genPickSet, genJudgeWin],
  unit2: [genJudgeWin, genJudgeWin, genDiscard, genSpeedCall, genPickSet, genCompletePung, genCompleteChow],
};
function buildSession(catId, count = 8) {
  const pool = catId === "mixed"
    ? [genIdSuit, genFindSuit, genReadNumber, genHonorId, genIsHonor, genPickSet, genCompletePung, genCompleteChow, genJudgeWin, genDiscard, genSpeedCall]
    : GEN_POOLS[catId];
  const steps = [];
  for (let i = 0; i < count; i++) steps.push(pickOne(pool)());
  steps.splice(2 + ri(3), 0, genFact()); // sprinkle a fact mid-session
  return steps;
}

/* ---------------- ENDLESS PRACTICE: hub + runner ---------------- */

const PRACTICE_CATS = [
  { id: "unit1", emoji: "①", name: "Unit 1 — fresh drills", desc: "Tiles, sets & the winning shape — new every time" },
  { id: "unit2", emoji: "②", name: "Unit 2 — fresh drills", desc: "Scoring, discards & defense — new every time" },
  { id: "recognition", emoji: "🀄", name: "Tile Recognition", desc: "Suits, numbers, winds & dragons" },
  { id: "sets", emoji: "🧩", name: "Sets & Melds", desc: "Pungs, chows, pairs & completions" },
  { id: "winning", emoji: "🏆", name: "Winning Hands", desc: "Spot real wins from fresh hands" },
  { id: "discards", emoji: "🎯", name: "Discards & Speed", desc: "Best throws & lightning calls" },
  { id: "mixed", emoji: "🎲", name: "Mixed Review", desc: "A bit of everything, shuffled" },
];

function PracticeRunner({ catId, title, teacher, addStars, onExit }) {
  const T = useT();
  const [round, setRound] = useState(0);
  const [steps, setSteps] = useState(() => buildSession(catId));
  const [done, setDone] = useState(false);
  const A = teacher.Comp;

  if (done) {
    return (
      <div style={{ position: "relative", minHeight: "min(92dvh,720px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 26px", textAlign: "center" }}>
        <Confetti />
        <A size={110} />
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 800, color: T.ink, margin: "14px 0 6px" }}>Session complete!</h2>
        <p style={{ fontSize: 15.5, color: T.sub, lineHeight: 1.55, margin: "0 0 22px", maxWidth: 330 }}>
          That set was freshly generated — the next one will be different. Keep going to stay sharp.
        </p>
        <Btn onClick={() => { setSteps(buildSession(catId)); setDone(false); setRound((r) => r + 1); }} tone="success" style={{ maxWidth: 320, marginBottom: 10 }}>New {title} session</Btn>
        <Btn onClick={onExit} style={{ maxWidth: 320, background: T.card, color: T.ink, boxShadow: T.cardShadow, border: `1.5px solid ${T.cardBorder}` }}>Back to practice</Btn>
      </div>
    );
  }
  return (
    <Lesson key={`prac-${catId}-${round}`} customSteps={steps} teacher={teacher}
      onExit={onExit} addStars={addStars} onComplete={() => setDone(true)} />
  );
}

function Practice({ teacher, addStars, onExit }) {
  const T = useT();
  const [cat, setCat] = useState(null);
  if (cat) return <PracticeRunner catId={cat.id} title={cat.name} teacher={teacher} addStars={addStars} onExit={() => setCat(null)} />;
  return (
    <div style={{ padding: "0 18px 30px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0 8px" }}>
        <button onClick={onExit} aria-label="Back" style={{ background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 13, width: 46, height: 46, fontSize: 18, color: T.sub, cursor: "pointer", boxShadow: T.chipShadow }}>‹</button>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.ink, margin: 0 }}>Endless Practice</h2>
      </div>
      <p style={{ fontSize: 14.5, color: T.sub, margin: "0 0 16px", lineHeight: 1.5 }}>
        Every session is freshly generated — new tiles, new hands, new questions each time. Pick a focus and drill it as much as you like.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {PRACTICE_CATS.map((c) => (
          <button key={c.id} onClick={() => setCat(c)} className="ss-btn"
            style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", width: "100%", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: T.radius, padding: "15px 16px", minHeight: 78, boxShadow: T.btnEdge ? `0 4px 0 ${T.cardBorder}` : T.cardShadow, cursor: "pointer", fontFamily: T.fontBody, WebkitTapHighlightColor: "transparent" }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, flexShrink: 0, background: "rgba(0,0,0,.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{c.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16.5, color: T.ink, fontFamily: T.fontDisplay }}>{c.name}</div>
              <div style={{ fontSize: 13.5, color: T.sub, marginTop: 2 }}>{c.desc}</div>
            </div>
            <span style={{ color: T.primary, fontSize: 21, fontWeight: 800 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */

export default function SparrowSchool() {
  const boot0 = useRef(lsLoad());
  const [screen, setScreen] = useState("landing");
  const [activeLesson, setActiveLesson] = useState(1);
  const [stars, setStars] = useState(boot0.current?.stars || 0);
  const [completed, setCompleted] = useState(boot0.current?.completed || []);
  const [themeId, setThemeId] = useState(boot0.current?.themeId || "duo");
  const [teacherId, setTeacherId] = useState(boot0.current?.teacherId || "auntie");
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!supabase);
  const [showNudge, setShowNudge] = useState(false);
  const [nudged, setNudged] = useState(false);
  const hydrated = useRef(false);
  const returning = (boot0.current?.completed?.length || 0) > 0;

  // persist to local memory on every change (works for guests, no backend needed)
  useEffect(() => {
    lsSave({ stars, completed, themeId, teacherId, visited: Date.now() });
  }, [stars, completed, themeId, teacherId]);

  const T = THEMES[themeId];
  const teacher = TEACHERS.find((t) => t.id === teacherId);
  const cloudOn = !!supabase;

  // a "real" account = signed in and not anonymous
  const account =
    user && !user.is_anonymous && user.email
      ? { provider: user.app_metadata?.provider === "google" ? "Google" : user.app_metadata?.provider === "apple" ? "Apple" : "email", label: user.email }
      : null;

  // ---- boot: sign in (anonymously if needed), then load progress ----
  useEffect(() => {
    if (!supabase) return; // local-only mode: app still works, just no sync
    let unsub;
    (async () => {
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.signInAnonymously();
          ({ data: { session } } = await supabase.auth.getSession());
        }
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          const { data } = await supabase
            .from("progress").select("*").eq("user_id", u.id).maybeSingle();
          if (data) {
            setStars((s) => Math.max(s, data.stars || 0));
            setCompleted((c) => Array.from(new Set([...c, ...(Array.isArray(data.completed) ? data.completed : [])])).sort((a, b) => a - b));
          }
        }
      } catch (e) {
        // network/config issue — fall back to local-only, never white-screen
        console.warn("Supabase boot failed, running locally:", e?.message);
      } finally {
        hydrated.current = true;
        setBooting(false);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    unsub = data?.subscription;
    return () => unsub?.unsubscribe();
  }, []);

  // ---- save progress (debounced) whenever it changes, once hydrated ----
  useEffect(() => {
    if (!supabase || !user || !hydrated.current) return;
    const t = setTimeout(() => {
      supabase.from("progress").upsert({
        user_id: user.id,
        stars,
        completed,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => { if (error) console.warn("save failed:", error.message); });
    }, 600);
    return () => clearTimeout(t);
  }, [stars, completed, user]);

  // ---- send magic link to upgrade the current guest to a real account ----
  const sendMagicLink = async (email) => {
    if (!supabase) {
      // local-only fallback so the UI still demonstrates the flow
      setUser({ id: "local", is_anonymous: false, email });
      return true;
    }
    try {
      // updateUser on an anonymous user links the email & keeps their progress
      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        // fallback: standard OTP/magic-link sign-in (also works for returning users)
        const { error: e2 } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (e2) return e2.message;
      }
      return true;
    } catch (e) {
      return e?.message || "Something went wrong.";
    }
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      await supabase.auth.signInAnonymously(); // keep playing as a fresh guest
    } else {
      setUser(null);
    }
    setScreen("profile");
  };

  const finishLesson = () => {
    setCompleted((c) => (c.includes(activeLesson) ? c : [...c, activeLesson]));
    setScreen("done");
    // soft nudge to save progress after Lesson 2, once, if still a guest
    if (!account && !nudged && activeLesson >= 2) {
      setNudged(true);
      setTimeout(() => setShowNudge(true), 2200);
    }
  };

  return (
    <ThemeCtx.Provider value={T}>
      <div className={`t-${themeId}`} style={{ minHeight: "100vh", background: T.pageBg, fontFamily: T.fontBody, color: T.ink, display: "flex", justifyContent: "center", transition: "background .35s ease" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@600;700;800&display=swap');
          * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
          .ss-app { width: min(480px, 100%); min-height: 100vh; background: ${T.surface}; position: relative; transition: background .35s ease; display: flex; flex-direction: column; }
          .ss-app-body { flex: 1; }
          @media (min-width: 768px) {
            .ss-app { min-height: 0; margin: 24px 0; border-radius: 36px; box-shadow: 0 26px 64px rgba(60,50,70,.18); overflow: hidden; }
            /* landing goes full-bleed on desktop */
            .ss-app.ss-fullbleed { width: 100%; max-width: 100%; margin: 0; border-radius: 0; box-shadow: none; }
          }
          .ss-navpop { animation: ssnavpop .3s cubic-bezier(.34,1.56,.64,1); display: inline-flex; }
          @keyframes ssnavpop { 0% { transform: scale(.8); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
          .t-duo .ss-btn:not(:disabled):active, .t-kawaii .ss-btn:not(:disabled):active { transform: translateY(3px); }
          .t-apple .ss-btn:not(:disabled):active { transform: scale(.97); opacity: .82; }
          .ss-tile:active { transform: translateY(4px) scale(.97); }
          @media (hover:hover) { .ss-tile:hover { transform: translateY(-3px) rotate(-1deg); } }
          .ss-pop { animation: sspop .38s cubic-bezier(.34,1.56,.64,1); }
          @keyframes sspop { 0% { transform: scale(.85); } 60% { transform: scale(1.1) rotate(1deg); } 100% { transform: scale(1); } }
          .ss-shake { animation: ssshake .4s ease; }
          @keyframes ssshake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 50% { transform: translateX(7px); } 75% { transform: translateX(-4px); } }
          .ss-bob { animation: ssbob 2.6s ease-in-out infinite; }
          @keyframes ssbob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          .ss-boat { animation: ssboat 7s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 85%; }
          @keyframes ssboat {
            0%   { transform: translateX(0) rotate(-1.3deg); }
            25%  { transform: translateX(-11px) translateY(-1.6px) rotate(0deg); }
            50%  { transform: translateX(-22px) rotate(1.3deg); }
            75%  { transform: translateX(-11px) translateY(1.4px) rotate(0deg); }
            100% { transform: translateX(0) rotate(-1.3deg); }
          }
          .ss-beat { animation: ssbeat 1.8s ease-in-out infinite; }
          @keyframes ssbeat { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
          .ss-gappulse { animation: ssgap 1.6s ease-in-out infinite; }
          @keyframes ssgap { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
          .ss-sparkle { animation: sstwinkle 1s ease infinite; }
          @keyframes sstwinkle { 0%,100% { opacity: 1; transform: scale(1) rotate(0deg);} 50% { opacity: .4; transform: scale(1.35) rotate(22deg);} }
          .ss-slide { animation: ssslide .4s cubic-bezier(.22,1,.36,1); }
          @keyframes ssslide { from { opacity: 0; transform: translateX(28px);} to { opacity: 1; transform: translateX(0);} }
          .ss-deal { animation: ssdeal .5s cubic-bezier(.34,1.4,.64,1) backwards; }
          @keyframes ssdeal { from { opacity: 0; transform: translateY(34px) rotate(-5deg) scale(.7); } to { opacity: 1; transform: translateY(0) rotate(0) scale(1); } }
          .ss-sheet { animation: sssheet .3s cubic-bezier(.34,1.3,.64,1); }
          @keyframes sssheet { from { transform: translateY(14px); opacity:.6; } to { transform: translateY(0); opacity:1; } }
          .ss-glow { animation: ssglow 2.2s ease-in-out infinite; }
          @keyframes ssglow { 0%,100% { } 50% { box-shadow: 0 0 0 6px ${T.primary}22; } }
          .ss-confetti { position: absolute; top: -16px; animation-name: ssfall; animation-timing-function: linear; animation-iteration-count: infinite; }
          @keyframes ssfall { to { transform: translateY(110vh) rotate(540deg); } }
          @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
          @keyframes ssflicker { 0%,18%,22%,25%,53%,57%,100% { opacity: 1; } 20%,24%,55% { opacity: .55; } }
          .ss-blink { animation: ssblink 5.5s ease-in-out infinite; }
          @keyframes ssblink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(.1); } }
          .ss-armbag { animation: ssarmbag 4.2s ease-in-out infinite; }
          @keyframes ssarmbag { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-5deg); } }
          .ss-bubblein { animation: ssbubblein .34s cubic-bezier(.34,1.56,.64,1) both; }
          .ss-bubbleout { animation: ssbubbleout .26s ease both; }
          @keyframes ssbubblein { 0% { opacity: 0; transform: translateY(6px) scale(.85); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes ssbubbleout { to { opacity: 0; transform: translateY(-4px) scale(.92); } }
          @keyframes ssland { 0% { transform: scale(1.7) translateY(-10px); opacity: 0; } 60% { transform: scale(.9); opacity: 1; } 100% { transform: scale(1); } }
          .ss-land2 { animation: ssland .32s cubic-bezier(.34,1.56,.64,1); }
          @keyframes ssflash { 0% { opacity: 0; transform: scale(.5) rotate(-8deg); } 25% { opacity: 1; transform: scale(1.12) rotate(-3deg); } 70% { opacity: 1; transform: scale(1) rotate(-3deg); } 100% { opacity: 0; transform: scale(1.05) rotate(-3deg); } }
          .ss-flash { animation: ssflash 1s ease-out forwards; }
          @keyframes sspulsering { 0% { box-shadow: 0 0 0 0 var(--pc); } 70% { box-shadow: 0 0 0 8px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
          .ss-pulsering { animation: sspulsering 1.4s ease-out infinite; }
          @keyframes ssthink { 0%,100% { transform: translateY(0); opacity:.4; } 50% { transform: translateY(-3px); opacity:1; } }
          .ss-tipfade { animation: sstipfade .5s ease both; }
          @keyframes sstipfade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {booting ? (
          <div className="ss-app" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
            <div style={{ textAlign: "center" }}>
              <div className="ss-bob"><teacher.Comp size={92} /></div>
              <div style={{ marginTop: 14, fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 16, color: T.sub }}>Shuffling tiles…</div>
            </div>
          </div>
        ) : (
        <div className={`ss-app ${screen === "landing" ? "ss-fullbleed" : ""}`}>
          <div className="ss-app-body">
            {screen === "landing" && (
              <Landing teacher={teacher} returning={returning} completedCount={completed.length} onStart={() => setScreen("home")} />
            )}
            {screen === "home" && (
              <Home stars={stars} completed={completed} teacher={teacher}
                onStart={(id) => { setActiveLesson(id); setScreen("lesson"); }}
                onSettings={() => setScreen("settings")}
                onLogo={() => setScreen("landing")}
                onSim={() => setScreen("sim")}
                onMemory={() => setScreen("memory")}
                onWin={() => setScreen("winanatomy")}
                onPractice={() => setScreen("practice")} />
            )}
            {screen === "practice" && (
              <Practice teacher={teacher} addStars={(n) => setStars((s) => s + n)} onExit={() => setScreen("home")} />
            )}
            {screen === "sim" && (
              <Sim teacher={teacher} onExit={() => setScreen("home")} />
            )}
            {screen === "memory" && (
              <MemoryGame teacher={teacher} onExit={() => setScreen("home")} />
            )}
            {screen === "winanatomy" && (
              <WinAnatomy teacher={teacher} onExit={() => setScreen("home")} />
            )}
            {screen === "daily" && (
              <Daily teacher={teacher} stars={stars}
                onSettings={() => setScreen("settings")} onLogo={() => setScreen("landing")} />
            )}
            {screen === "profile" && (
              <Profile teacher={teacher} account={account} stars={stars} completed={completed}
                onSettings={() => setScreen("settings")} onAccount={() => setScreen("account")}
                onLogo={() => setScreen("landing")} />
            )}
            {screen === "settings" && (
              <Settings themeId={themeId} setThemeId={setThemeId} teacherId={teacherId} setTeacherId={setTeacherId}
                account={account} onAccount={() => setScreen("account")} onBack={() => setScreen("profile")} />
            )}
            {screen === "account" && (
              <Account account={account} stars={stars} completed={completed} cloudOn={cloudOn}
                onSendLink={sendMagicLink} onSignOut={signOut} onBack={() => setScreen("profile")} />
            )}
            {screen === "lesson" && (
              <Lesson key={`${activeLesson}`} lessonId={activeLesson} teacher={teacher}
                onExit={() => setScreen("home")}
                addStars={(n) => setStars((s) => s + n)}
                onComplete={finishLesson} />
            )}
            {screen === "done" && <Complete stars={stars} lessonId={activeLesson} teacher={teacher} onHome={() => setScreen("home")} onSim={() => setScreen("sim")} />}
          </div>

          {["home", "daily", "profile"].includes(screen) && (
            <BottomNav active={screen} onNav={(id) => setScreen(id)} />
          )}
        </div>
        )}
        {showNudge && (
          <SaveNudge onSignIn={() => { setShowNudge(false); setScreen("account"); }} onLater={() => setShowNudge(false)} />
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
