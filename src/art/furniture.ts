/** Original, simple, rounded SVG art for furniture and decorations. Every item takes a colour. */

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.round(Math.min(255, Math.max(0, v)));
  };
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const svg = (vb: string, body: string) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" class="art">${body}</svg>`;
const O = '#5b4a6b';
const S = `stroke="${O}" stroke-width="3" stroke-linejoin="round"`;

const ART: Record<string, (c: string) => string> = {
  plant: (c) =>
    svg('0 0 60 80', `<path d="M30 46 C10 40 6 20 14 10 C24 16 30 30 30 46Z" fill="${c}" ${S}/><path d="M30 46 C50 40 56 22 48 12 C38 18 30 30 30 46Z" fill="${shade(c, 0.2)}" ${S}/><path d="M30 46 C26 30 30 14 30 6 C34 14 36 30 30 46Z" fill="${shade(c, -0.15)}" ${S}/><path d="M16 46 H44 L40 76 H20Z" fill="#f2a36b" ${S}/><rect x="13" y="44" width="34" height="8" rx="4" fill="#ffbf8a" ${S}/>`),
  picture: (c) =>
    svg('0 0 70 56', `<rect x="3" y="3" width="64" height="50" rx="8" fill="${c}" ${S}/><rect x="11" y="11" width="48" height="34" rx="4" fill="#bfe8ff"/><circle cx="48" cy="20" r="5" fill="#ffe066"/><path d="M11 45 L26 26 L36 37 L44 30 L59 45Z" fill="#7ccf6a"/>`),
  lamp: (c) =>
    svg('0 0 50 100', `<path d="M10 34 L18 6 H32 L40 34Z" fill="${c}" ${S}/><rect x="22" y="34" width="6" height="52" fill="#c9b7d6" ${S}/><ellipse cx="25" cy="90" rx="16" ry="6" fill="${shade(c, -0.25)}" ${S}/>`),
  rug: (c) =>
    svg('0 0 120 50', `<ellipse cx="60" cy="25" rx="57" ry="22" fill="${c}" ${S}/><ellipse cx="60" cy="25" rx="42" ry="15" fill="${shade(c, 0.35)}"/><ellipse cx="60" cy="25" rx="24" ry="8" fill="${shade(c, -0.1)}"/>`),
  chair: (c) =>
    svg('0 0 60 90', `<rect x="10" y="4" width="40" height="44" rx="12" fill="${c}" ${S}/><rect x="6" y="46" width="48" height="14" rx="7" fill="${shade(c, -0.15)}" ${S}/><rect x="10" y="58" width="6" height="28" rx="3" fill="${shade(c, -0.3)}" ${S}/><rect x="44" y="58" width="6" height="28" rx="3" fill="${shade(c, -0.3)}" ${S}/>`),
  beanbag: (c) =>
    svg('0 0 80 64', `<path d="M8 58 C0 40 14 8 40 8 C66 8 80 40 72 58 Z" fill="${c}" ${S}/><path d="M20 30 C28 38 52 38 60 30" fill="none" stroke="${shade(c, -0.25)}" stroke-width="4" stroke-linecap="round"/><ellipse cx="30" cy="20" rx="8" ry="4" fill="${shade(c, 0.4)}"/>`),
  table: (c) =>
    svg('0 0 100 70', `<rect x="4" y="10" width="92" height="14" rx="7" fill="${c}" ${S}/><rect x="14" y="22" width="8" height="44" rx="4" fill="${shade(c, -0.2)}" ${S}/><rect x="78" y="22" width="8" height="44" rx="4" fill="${shade(c, -0.2)}" ${S}/><circle cx="50" cy="6" r="5" fill="#ff8fb1"/>`),
  bookshelf: (c) =>
    svg('0 0 70 110', `<rect x="4" y="4" width="62" height="102" rx="8" fill="${c}" ${S}/>${[14, 46, 78]
      .map(
        (y, i) =>
          `<rect x="10" y="${y}" width="50" height="26" rx="3" fill="${shade(c, -0.3)}"/>${[0, 1, 2, 3, 4]
            .map((j) => `<rect x="${13 + j * 9}" y="${y + 4 + ((i + j) % 2) * 3}" width="7" height="${22 - ((i + j) % 2) * 3}" rx="2" fill="${['#ff8fb1', '#7fc8ff', '#ffe066', '#7ccf6a', '#c88bff'][(i + j) % 5]}"/>`)
            .join('')}`,
      )
      .join('')}`),
  sofa: (c) =>
    svg('0 0 140 80', `<rect x="18" y="8" width="104" height="40" rx="16" fill="${shade(c, -0.1)}" ${S}/><rect x="4" y="30" width="28" height="40" rx="14" fill="${c}" ${S}/><rect x="108" y="30" width="28" height="40" rx="14" fill="${c}" ${S}/><rect x="26" y="42" width="88" height="26" rx="10" fill="${c}" ${S}/><line x1="70" y1="44" x2="70" y2="66" stroke="${shade(c, -0.3)}" stroke-width="3"/><rect x="16" y="68" width="8" height="8" rx="2" fill="${O}"/><rect x="116" y="68" width="8" height="8" rx="2" fill="${O}"/>`),
  wardrobe: (c) =>
    svg('0 0 80 120', `<rect x="4" y="4" width="72" height="108" rx="10" fill="${c}" ${S}/><line x1="40" y1="8" x2="40" y2="108" stroke="${O}" stroke-width="3"/><circle cx="33" cy="58" r="4" fill="#ffe066" ${S}/><circle cx="47" cy="58" r="4" fill="#ffe066" ${S}/><rect x="10" y="112" width="10" height="6" fill="${O}"/><rect x="60" y="112" width="10" height="6" fill="${O}"/>`),
  bed: (c) =>
    svg('0 0 140 90', `<rect x="4" y="10" width="22" height="74" rx="10" fill="#d9a066" ${S}/><rect x="16" y="42" width="120" height="30" rx="10" fill="#ffffff" ${S}/><rect x="56" y="38" width="80" height="34" rx="12" fill="${c}" ${S}/><ellipse cx="38" cy="44" rx="16" ry="9" fill="#fff6fb" ${S}/><rect x="14" y="70" width="124" height="12" rx="6" fill="#d9a066" ${S}/>`),
  bathtub: (c) =>
    svg('0 0 130 80', `<circle cx="34" cy="16" r="7" fill="#d8f1ff" stroke="#9fd6f5" stroke-width="2"/><circle cx="52" cy="10" r="5" fill="#d8f1ff" stroke="#9fd6f5" stroke-width="2"/><circle cx="96" cy="14" r="6" fill="#d8f1ff" stroke="#9fd6f5" stroke-width="2"/><path d="M6 30 H124 V44 C124 62 108 70 92 70 H38 C22 70 6 62 6 44Z" fill="${c}" ${S}/><path d="M14 36 H116" stroke="#7fd0ff" stroke-width="6" stroke-linecap="round"/><rect x="24" y="68" width="8" height="10" rx="3" fill="${O}"/><rect x="98" y="68" width="8" height="10" rx="3" fill="${O}"/>`),
  balloons: (c) =>
    svg('0 0 70 110', `<path d="M22 46 Q30 80 34 106 M48 40 Q40 80 34 106 M35 30 Q34 70 34 106" stroke="${O}" stroke-width="2" fill="none"/><ellipse cx="22" cy="30" rx="15" ry="18" fill="${c}" ${S}/><ellipse cx="48" cy="26" rx="15" ry="18" fill="${shade(c, 0.4)}" ${S}/><ellipse cx="35" cy="18" rx="14" ry="16" fill="#ffe066" ${S}/>`),
  notebook: (c) =>
    svg('0 0 70 90', `<rect x="4" y="8" width="62" height="78" rx="8" fill="#c98a55" ${S}/><rect x="11" y="18" width="48" height="62" rx="4" fill="#ffffff" ${S}/><rect x="22" y="3" width="26" height="14" rx="5" fill="#c9c9d6" ${S}/>${[30, 40, 50, 60, 70]
      .map((y) => `<line x1="17" y1="${y}" x2="53" y2="${y}" stroke="#bcd8ff" stroke-width="2"/>`)
      .join('')}<rect x="40" y="44" width="22" height="30" rx="3" fill="${c}" ${S} transform="rotate(12 51 59)"/>`),
  lights: (c) =>
    svg('0 0 220 40', `<path d="M4 6 Q55 34 110 10 Q165 34 216 6" fill="none" stroke="#4d8a4f" stroke-width="3"/>${[18, 40, 62, 84, 110, 136, 158, 180, 202]
      .map((x, i) => {
        const y = x < 110 ? 6 + Math.sin(((x - 4) / 106) * Math.PI) * 15 : 6 + Math.sin(((x - 110) / 106) * Math.PI) * 15;
        const col = i % 3 === 0 ? c : i % 3 === 1 ? '#ff8fb1' : '#7fd0ff';
        return `<g class="bulb" style="animation-delay:${(i % 3) * 0.4}s"><rect x="${x - 3}" y="${y}" width="6" height="5" fill="#4d8a4f"/><ellipse cx="${x}" cy="${y + 12}" rx="6" ry="8" fill="${col}" stroke="${shade(col, -0.3)}" stroke-width="2"/></g>`;
      })
      .join('')}`),
  discoball: (c) =>
    svg('0 0 60 80', `<line x1="30" y1="0" x2="30" y2="20" stroke="${O}" stroke-width="2"/><circle cx="30" cy="48" r="26" fill="${c}" ${S}/>${[0, 1, 2, 3, 4]
      .map((i) => `<path d="M${10 + i * 10} 30 V66" stroke="${shade(c, -0.25)}" stroke-width="1.5"/><path d="M6 ${32 + i * 8} H54" stroke="${shade(c, -0.25)}" stroke-width="1.5"/>`)
      .join('')}<circle cx="20" cy="38" r="5" fill="#ffffff" class="sparkle"/>`),
  dancefloor: (c) =>
    svg('0 0 160 70', `<path d="M24 4 H136 L156 66 H4Z" fill="${shade(c, -0.3)}" ${S}/>${[0, 1, 2]
      .map((r) =>
        [0, 1, 2, 3, 4]
          .map((k) => {
            const y0 = 8 + r * 19;
            const y1 = y0 + 17;
            const lx0 = 24 - (y0 - 4) * 0.32;
            const lx1 = 24 - (y1 - 4) * 0.32;
            const w0 = (160 - 2 * lx0) / 5;
            const w1 = (160 - 2 * lx1) / 5;
            const cols = [c, '#ff8fb1', '#ffe066', '#7fd0ff', '#7ccf6a'];
            return `<path class="tile" style="animation-delay:${((r + k) % 4) * 0.25}s" d="M${lx0 + k * w0 + 1} ${y0} H${lx0 + (k + 1) * w0 - 1} L${lx1 + (k + 1) * w1 - 1} ${y1} H${lx1 + k * w1 + 1}Z" fill="${cols[(r * 2 + k) % 5]}"/>`;
          })
          .join(''),
      )
      .join('')}`),
  starbed: (c) =>
    svg('0 0 140 100', `<path d="M20 50 L26 10 L34 32 L46 4 L54 32 L66 14 L70 50Z" fill="#ffe066" ${S}/><rect x="10" y="48" width="126" height="30" rx="12" fill="#ffffff" ${S}/><rect x="56" y="42" width="80" height="36" rx="14" fill="${c}" ${S}/>${[70, 92, 114]
      .map((x) => `<path d="M${x} 52 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1z" fill="#ffe066"/>`)
      .join('')}<ellipse cx="34" cy="50" rx="16" ry="9" fill="#fff6fb" ${S}/><rect x="6" y="76" width="134" height="14" rx="7" fill="${shade(c, -0.3)}" ${S}/>`),
  canopybed: (c) =>
    svg('0 0 140 130', `<rect x="8" y="10" width="6" height="110" fill="#d9a066" ${S}/><rect x="126" y="10" width="6" height="110" fill="#d9a066" ${S}/><path d="M4 8 Q70 -4 136 8 L136 22 Q120 34 104 22 Q88 34 70 22 Q52 34 36 22 Q20 34 4 22Z" fill="${c}" ${S}/><path d="M14 22 Q24 70 16 96 L8 96 L8 22Z M126 22 Q116 70 124 96 L132 96 L132 22Z" fill="${shade(c, 0.45)}" opacity="0.9"/><rect x="12" y="78" width="118" height="30" rx="12" fill="#ffffff" ${S}/><rect x="56" y="74" width="74" height="34" rx="14" fill="${c}" ${S}/><ellipse cx="34" cy="80" rx="16" ry="9" fill="#fff6fb" ${S}/><circle cx="76" cy="90" r="4" fill="#ffffff"/><circle cx="96" cy="86" r="4" fill="#ffffff"/><circle cx="114" cy="94" r="4" fill="#ffffff"/><rect x="8" y="106" width="124" height="14" rx="7" fill="#d9a066" ${S}/>`),
};

export function itemArt(itemId: string, color: string): string {
  return (ART[itemId] ?? ART.plant)(color);
}

/** Outside view through the window for each house style. */
export function windowScene(style: string): string {
  const frame = (inner: string, shape = 'rect') =>
    svg(
      '0 0 120 100',
      `<defs><clipPath id="w-${style}">${shape === 'round' ? '<circle cx="60" cy="50" r="44"/>' : '<rect x="6" y="6" width="108" height="88" rx="14"/>'}</clipPath></defs><g clip-path="url(#w-${style})"><rect width="120" height="100" fill="#bfe8ff"/>${inner}</g>${
        shape === 'round'
          ? `<circle cx="60" cy="50" r="44" fill="none" stroke="#c98a55" stroke-width="8"/><path d="M60 6 V94 M16 50 H104" stroke="#c98a55" stroke-width="5"/>`
          : `<rect x="6" y="6" width="108" height="88" rx="14" fill="none" stroke="#ffffff" stroke-width="8"/><path d="M60 6 V94" stroke="#ffffff" stroke-width="5"/>`
      }`,
    );
  switch (style) {
    case 'apartment':
      return frame(`<circle cx="94" cy="22" r="9" fill="#ffe066"/>${[
        [8, 40, 18],
        [28, 28, 16],
        [46, 50, 20],
        [68, 34, 18],
        [88, 46, 24],
      ]
        .map(([x, y, w], i) => `<rect x="${x}" y="${y}" width="${w}" height="${100 - y}" rx="3" fill="${['#a7b6ff', '#c8a7ff', '#8fd1ff', '#ffb3d1', '#9fe0c0'][i]}"/>${[0, 1, 2, 3].map((k) => `<rect x="${x + 4}" y="${y + 6 + k * 12}" width="4" height="5" fill="#fff6a8"/><rect x="${x + w - 8}" y="${y + 6 + k * 12}" width="4" height="5" fill="#fff6a8"/>`).join('')}`)
        .join('')}`);
    case 'farmhouse':
      return frame(`<circle cx="24" cy="22" r="10" fill="#ffe066"/><path d="M0 64 Q40 50 80 62 T120 58 V100 H0Z" fill="#9ee07a"/><path d="M0 78 Q60 66 120 80 V100 H0Z" fill="#7ccf6a"/><rect x="76" y="40" width="26" height="26" fill="#ff7a6b"/><path d="M72 42 L89 28 L106 42Z" fill="#c94f45"/><circle cx="30" cy="72" r="6" fill="#ffe066"/><circle cx="46" cy="76" r="5" fill="#ffe066"/>`);
    case 'treehouse':
      return frame(`<circle cx="30" cy="30" r="26" fill="#7ccf6a"/><circle cx="80" cy="20" r="30" fill="#5cc36b"/><circle cx="100" cy="70" r="26" fill="#8ee08a"/><circle cx="20" cy="80" r="24" fill="#6fd17a"/><circle cx="56" cy="56" r="10" fill="#ff8fb1"/><circle cx="62" cy="40" r="4" fill="#ff5d7a"/><circle cx="40" cy="64" r="4" fill="#ff5d7a"/>`, 'round');
    default:
      return frame(`<circle cx="92" cy="24" r="10" fill="#ffe066"/><ellipse cx="34" cy="28" rx="16" ry="7" fill="#ffffff"/><path d="M0 70 Q30 56 60 68 T120 64 V100 H0Z" fill="#9ee07a"/>${[16, 40, 70, 96]
        .map((x, i) => `<circle cx="${x}" cy="${80 + (i % 2) * 6}" r="5" fill="${['#ff8fb1', '#ffe066', '#c88bff', '#ff8fb1'][i]}"/>`)
        .join('')}`, 'round');
  }
}
