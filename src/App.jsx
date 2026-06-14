import React, { useState, useMemo, useRef, createContext, useContext } from "react";

/* ============================================================
   SPARROW SCHOOL — interactive mahjong tutorial (prototype v4)
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

/* ---------------- TEACHER AVATARS ---------------- */

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
      type: "teach", title: "Welcome to Sparrow School",
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
      tiles: [], requireAll: false, note: "Draw → choose → discard. Always.",
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
      tiles: [], requireAll: false, note: "Mind what you feed the pond.",
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
      tiles: [], requireAll: false, note: "食 > 碰 > 上",
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
      say: (t) => <>Tiles, sets, the winning shape, turns, calls — that's a <b>complete game</b> of Hong Kong mahjong. What's left is scoring (<b>fan 番</b>) and strategy… which is where the real fun — and your relatives' pocket money — lives. Unit 2 is on the way.</>,
      tiles: [], requireAll: false,
    },
  ],
};

const LESSONS = [
  { id: 1, name: "Meet the Tiles", cn: "認牌", sub: "The three suits", color: "#E2231A", Icon: IconTile },
  { id: 2, name: "Winds & Dragons", cn: "風與龍", sub: "The honor tiles", color: "#0860A8", Icon: IconDragon },
  { id: 3, name: "Building Sets", cn: "砌組合", sub: "Pung · Chow · Pair", color: "#00A862", Icon: IconSteamer },
  { id: 4, name: "The Winning Hand", cn: "食糊", sub: "4 sets + a pair", color: "#7D499D", Icon: IconNeonWin },
  { id: 5, name: "Your First Turn", cn: "打牌", sub: "Draw & discard", color: "#F7943E", Icon: IconTaxi },
  { id: 6, name: "Calling Tiles", cn: "叫牌", sub: "Pung! Sik wu!", color: "#9C5B25", Icon: IconPung },
];

const COMPLETE_COPY = {
  1: "You can now tell every suit apart — the part that makes beginners freeze. Next stop: the honor tiles.",
  2: "Winds, dragons, and flowers — you now recognize every tile in the set. Next: snapping tiles into sets.",
  3: "Pair, pung, chow — you speak mahjong's entire vocabulary now. Time to assemble a winning hand.",
  4: "You know the winning shape: 4 sets + a pair. From here on, every tile is either helping or in the way.",
  5: "Draw, judge, discard — you could sit at a table right now and hold your own. Next: interrupting everyone else.",
  6: "That's the full game loop — you officially know how to play Hong Kong mahjong. Unit 2 brings scoring 番 and the strategy that wins money.",
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
      aria-label="Sparrow School home">
      <span>sparrow<span style={{ color: T.neonPink, textShadow: T.neon ? `0 0 9px ${T.neonPink}80, 0 0 22px ${T.neonPink}40` : "none" }}>school</span></span>
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

function Home({ stars, completed, teacher, onStart, onSettings, onLogo }) {
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
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 15.5, fontFamily: T.fontDisplay, letterSpacing: ".01em" }}>Sparrow Line</span>
        <span style={{ color: "#B9C0C9", fontWeight: 700, fontSize: 14, fontFamily: "'Noto Sans TC',sans-serif" }}>雀線</span>
        <span style={{ marginLeft: "auto", color: "#B9C0C9", fontWeight: 800, fontSize: 12.5 }}>{completed.length}/6</span>
      </div>

      {/* MTR-diagram lesson path */}
      <div>
        {LESSONS.map((l, i) => {
          const done = completed.includes(l.id);
          const unlocked = l.id === 1 || completed.includes(l.id - 1);
          const prevDone = i === 0 ? true : completed.includes(LESSONS[i - 1].id);
          return (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12 }}>
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
          );
        })}

        {/* line extension: Unit 2 */}
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 0, flex: 1, minHeight: 16, borderLeft: `4px dashed ${completed.length === 6 ? "#9C5B25" : "#CFCBC2"}` }} />
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", border: `4px dashed ${MTR_INK}66` }} />
          </div>
          <div style={{
            border: `2px dashed ${T.cardBorder}`, borderRadius: T.radius,
            padding: "14px 16px", margin: "8px 0 4px", minHeight: 70,
            display: "flex", alignItems: "center", gap: 13, opacity: 0.85,
          }}>
            <div style={{ fontSize: 23 }}>🚧</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: T.sub, fontFamily: T.fontDisplay }}>Unit 2 — Scoring & Strategy</div>
              <div style={{ fontSize: 13, color: T.sub, marginTop: 1 }}>
                <span style={{ fontFamily: "'Noto Sans TC',sans-serif", fontWeight: 700 }}>番數同戰術</span> · 6 more stations under construction
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- LESSON ---------------- */

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

function Lesson({ lessonId, teacher, onExit, onComplete, addStars }) {
  const T = useT();
  const STEPS = LESSON_CONTENT[lessonId];
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

function Complete({ stars, lessonId, teacher, onHome }) {
  const T = useT();
  const A = teacher.Comp;
  return (
    <div style={{ position: "relative", minHeight: "min(92dvh, 740px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 26px", textAlign: "center" }}>
      <Confetti />
      <A size={124} />
      <h2 style={{ fontFamily: T.fontDisplay, fontSize: 30, fontWeight: 800, color: T.ink, margin: "16px 0 8px", letterSpacing: T.displaySpacing }}>
        {lessonId === 6 ? "You can play mahjong!" : "Lesson complete!"}
      </h2>
      <p style={{ fontSize: 16.5, color: T.sub, lineHeight: 1.6, margin: "0 0 20px", maxWidth: 360 }}>
        {COMPLETE_COPY[lessonId]}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 999, padding: "12px 24px", fontWeight: 800, fontSize: 19, color: T.ink, boxShadow: T.chipShadow, marginBottom: 30, backdropFilter: T.glass ? "blur(18px)" : undefined }}>
        <span style={{ color: T.star, fontSize: 22 }}>★</span> {stars} stars
      </div>
      <Btn onClick={onHome} style={{ maxWidth: 330 }}>Back to the line</Btn>
    </div>
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

      <h3 style={{ fontSize: 13.5, fontWeight: 800, color: T.sub, textTransform: "uppercase", letterSpacing: ".07em", margin: "18px 0 10px" }}>Theme</h3>
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

function Landing({ onStart, teacher }) {
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
              sparrow<span style={{ color: "#FF4D8D", textShadow: "0 0 10px #FF4D8D88" }}>school</span>
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
          <div className="ss-hero-mascot" style={{ filter: "drop-shadow(0 8px 24px rgba(255,77,141,.35))" }}><A size={104} /></div>
          <button onClick={onStart} className="ss-btn ss-hero-cta"
            style={{ width: "min(330px,100%)", minHeight: 60, fontSize: 18.5, fontWeight: 800, fontFamily: T.fontBody, color: "#fff", background: "#FF4D8D", border: "none", borderRadius: 18, boxShadow: "0 6px 24px rgba(255,77,141,.5), 0 4px 0 #C9296A", cursor: "pointer", letterSpacing: ".01em", WebkitTapHighlightColor: "transparent" }}>
            Start learning — it's free
          </button>
          <div className="ss-hero-meta" style={{ color: "#B9AEC9", fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
            <span>★ No ads</span><span>·</span><span>5 min a day</span><span>·</span><span>No sign-up needed</span>
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
          <div style={{ position: "relative", marginTop: 22, color: "#7E7191", fontSize: 12 }}>A Rock Paper Chopsticks product · 麻雀 = sparrow</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ACCOUNT / AUTH (prototype) ---------------- */

function Account({ account, onSignIn, onSignOut, onBack, stars, completed }) {
  const T = useT();
  const providers = [
    { id: "apple", label: "Continue with Apple", bg: "#000", fg: "#fff", mark: "" },
    { id: "google", label: "Continue with Google", bg: "#fff", fg: "#3A3A40", mark: "G" },
    { id: "email", label: "Email me a magic link", bg: T.primary, fg: "#fff", mark: "✉" },
  ];
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
            <div style={{ fontWeight: 800, fontSize: 19, color: T.ink, fontFamily: T.fontDisplay }}>{account.label}</div>
            <div style={{ fontSize: 14, color: T.sub, marginTop: 3 }}>Signed in with {account.provider} · progress synced</div>
          </div>
          <div style={{ display: "flex", gap: 11, margin: "18px 0 22px" }}>
            <div style={{ flex: 1, textAlign: "center", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "16px 0", boxShadow: T.cardShadow }}>
              <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 26, color: T.ink }}>★ {stars}</div>
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>stars earned</div>
            </div>
            <div style={{ flex: 1, textAlign: "center", background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, padding: "16px 0", boxShadow: T.cardShadow }}>
              <div style={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 26, color: T.ink }}>{completed.length}/6</div>
              <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>lessons done</div>
            </div>
          </div>
          <button onClick={onSignOut} style={{ width: "100%", minHeight: 52, fontWeight: 800, fontSize: 16, fontFamily: T.fontBody, color: T.danger, background: T.card, border: `1.5px solid ${T.cardBorder}`, borderRadius: 16, boxShadow: T.cardShadow, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Sign out</button>
        </>
      ) : (
        <>
          <div style={{ textAlign: "center", padding: "18px 10px 6px" }}>
            <div style={{ fontSize: 40 }}>☁︎</div>
            <h3 style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 800, color: T.ink, margin: "8px 0 6px" }}>Keep your progress safe</h3>
            <p style={{ fontSize: 14.5, color: T.sub, lineHeight: 1.55, margin: "0 auto", maxWidth: 320 }}>
              You're learning as a guest — everything's saved on this device. Sign in to sync your stars and streak across your phone, tablet, and laptop.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 22 }}>
            {providers.map((p) => (
              <button key={p.id} onClick={() => onSignIn(p)}
                className="ss-btn"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  width: "100%", minHeight: 56, fontSize: 16.5, fontWeight: 800, fontFamily: T.fontBody,
                  color: p.fg, background: p.bg,
                  border: p.id === "google" ? `1.5px solid ${T.cardBorder}` : "none",
                  borderRadius: 16, cursor: "pointer",
                  boxShadow: T.btnEdge ? "0 4px 0 rgba(0,0,0,.16)" : "0 2px 10px rgba(0,0,0,.12)",
                  WebkitTapHighlightColor: "transparent",
                }}>
                {p.mark && <span style={{ fontWeight: 800, fontSize: 18 }}>{p.mark}</span>}
                {p.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: T.sub, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
            No passwords, ever. We'll never post anything or share your info.<br />
            <span style={{ opacity: .8 }}>Prototype — production wires these to Supabase Auth.</span>
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
        {[["★ " + stars, "stars"], [completed.length + "/6", "lessons"], ["0", "day streak"]].map((s, i) => (
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

/* ---------------- APP ---------------- */

export default function SparrowSchool() {
  const [screen, setScreen] = useState("landing");
  const [activeLesson, setActiveLesson] = useState(1);
  const [stars, setStars] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [themeId, setThemeId] = useState("duo");
  const [teacherId, setTeacherId] = useState("mai");
  const [account, setAccount] = useState(null);
  const [showNudge, setShowNudge] = useState(false);
  const [nudged, setNudged] = useState(false);

  const T = THEMES[themeId];
  const teacher = TEACHERS.find((t) => t.id === teacherId);

  const signIn = (p) => {
    setAccount({ provider: p.id === "apple" ? "Apple" : p.id === "google" ? "Google" : "email", label: p.id === "email" ? "you@email.com" : "Sparrow learner" });
    setShowNudge(false);
    setScreen("home");
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
        `}</style>

        <div className={`ss-app ${screen === "landing" ? "ss-fullbleed" : ""}`}>
          <div className="ss-app-body">
            {screen === "landing" && (
              <Landing teacher={teacher} onStart={() => setScreen("home")} />
            )}
            {screen === "home" && (
              <Home stars={stars} completed={completed} teacher={teacher}
                onStart={(id) => { setActiveLesson(id); setScreen("lesson"); }}
                onSettings={() => setScreen("settings")}
                onLogo={() => setScreen("landing")} />
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
              <Account account={account} stars={stars} completed={completed}
                onSignIn={signIn} onSignOut={() => setAccount(null)} onBack={() => setScreen("profile")} />
            )}
            {screen === "lesson" && (
              <Lesson key={`${activeLesson}`} lessonId={activeLesson} teacher={teacher}
                onExit={() => setScreen("home")}
                addStars={(n) => setStars((s) => s + n)}
                onComplete={finishLesson} />
            )}
            {screen === "done" && <Complete stars={stars} lessonId={activeLesson} teacher={teacher} onHome={() => setScreen("home")} />}
          </div>

          {["home", "daily", "profile"].includes(screen) && (
            <BottomNav active={screen} onNav={(id) => setScreen(id)} />
          )}
        </div>
        {showNudge && (
          <SaveNudge onSignIn={() => { setShowNudge(false); setScreen("account"); }} onLater={() => setShowNudge(false)} />
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
