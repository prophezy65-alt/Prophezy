// Deterministic, hash-seeded SVG covers — Linear/Stripe/Vercel-style mesh
// gradients + geometric line art, generated per post from its slug and
// category. No external images, no stock photos.

const CATEGORY_HUES: Record<string, number> = {
  ai: 185,
  "machine-learning": 265,
  "data-science": 210,
  python: 50,
  "web-development": 150,
  resumes: 20,
  internships: 340,
  placements: 300,
  "career-guidance": 15,
  "open-source": 130,
  github: 250,
  "interview-preparation": 5,
  productivity: 95,
  "college-life": 320,
  research: 200,
  "learning-roadmaps": 235,
  "ai-tools": 175,
  "career-trends": 30,
  product: 195,
};

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Cheap deterministic pseudo-random in [0,1), seeded per call site so the
// same post always renders identically.
function prand(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function meshBlobs(seed: number, hue: number, accentHue: number, uid: string): string {
  const blobs: string[] = [];
  const positions = [
    { cx: 90 + prand(seed, 1) * 60, cy: 60 + prand(seed, 2) * 40, r: 130, hue, op: 0.62 },
    { cx: 480 + prand(seed, 3) * 60, cy: 210 + prand(seed, 4) * 50, r: 150, hue: accentHue, op: 0.52 },
    { cx: 320 + prand(seed, 5) * 80, cy: 40 + prand(seed, 6) * 30, r: 100, hue: (hue + accentHue) / 2, op: 0.4 },
  ];
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    blobs.push(
      `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="hsla(${p.hue},92%,58%,${p.op})" filter="url(#blur-${uid})" />`
    );
  }
  return blobs.join("\n      ");
}

function foregroundPattern(seed: number, accentHue: number): string {
  const variant = seed % 8;
  const stroke = (op: number) => `hsla(${accentHue},85%,72%,${op})`;
  const shapes: string[] = [];

  switch (variant) {
    case 0: // concentric arcs
      for (let i = 0; i < 5; i++) {
        shapes.push(`<circle cx="540" cy="50" r="${50 + i * 38}" fill="none" stroke="${stroke(0.18 - i * 0.025)}" stroke-width="1.4" />`);
      }
      break;
    case 1: // dot grid
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 9; c++) {
          const x = 36 + c * 42 + prand(seed, c + r * 9) * 8;
          const y = 30 + r * 42;
          shapes.push(`<circle cx="${x}" cy="${y}" r="1.8" fill="${stroke(0.4)}" />`);
        }
      }
      break;
    case 2: // diagonal lines
      for (let i = 0; i < 7; i++) {
        const offset = i * 60;
        shapes.push(`<line x1="${offset - 100}" y1="260" x2="${offset + 160}" y2="-20" stroke="${stroke(0.15)}" stroke-width="1.6" />`);
      }
      break;
    case 3: // polygon cluster
      for (let i = 0; i < 6; i++) {
        const cx = 380 + i * 36;
        const cy = 50 + (i % 3) * 70;
        const size = 20 + (i % 3) * 9;
        shapes.push(
          `<polygon points="${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}" fill="none" stroke="${stroke(0.25)}" stroke-width="1.4" />`
        );
      }
      break;
    case 4: // orbit rings with nodes
      for (let i = 0; i < 3; i++) {
        const rx = 90 + i * 55;
        const ry = 40 + i * 22;
        shapes.push(
          `<ellipse cx="470" cy="150" rx="${rx}" ry="${ry}" fill="none" stroke="${stroke(0.2)}" stroke-width="1.3" transform="rotate(${-18 + i * 8} 470 150)" />`
        );
      }
      for (let i = 0; i < 4; i++) {
        const x = 400 + i * 45 + prand(seed, i) * 20;
        const y = 100 + prand(seed, i + 10) * 90;
        shapes.push(`<circle cx="${x}" cy="${y}" r="3" fill="${stroke(0.7)}" />`);
      }
      break;
    case 5: // circuit-style right angles
      shapes.push(
        `<path d="M420 30 L420 90 L470 90 L470 140 L540 140 L540 200" fill="none" stroke="${stroke(0.28)}" stroke-width="1.6" />`,
        `<path d="M360 220 L400 220 L400 170 L450 170" fill="none" stroke="${stroke(0.22)}" stroke-width="1.6" />`,
        `<circle cx="420" cy="30" r="3" fill="${stroke(0.7)}" />`,
        `<circle cx="540" cy="200" r="3" fill="${stroke(0.7)}" />`,
        `<circle cx="360" cy="220" r="3" fill="${stroke(0.7)}" />`
      );
      break;
    case 6: // triangular mesh / low-poly wedge
      for (let i = 0; i < 5; i++) {
        const x1 = 360 + i * 40;
        const y1 = 40 + prand(seed, i) * 30;
        const y2 = 200 + prand(seed, i + 5) * 30;
        shapes.push(`<line x1="${x1}" y1="${y1}" x2="${x1 + 40}" y2="${y2}" stroke="${stroke(0.16)}" stroke-width="1.2" />`);
      }
      shapes.push(`<polygon points="480,60 560,90 520,170" fill="none" stroke="${stroke(0.3)}" stroke-width="1.4" />`);
      break;
    default: // wave lines
      for (let i = 0; i < 4; i++) {
        const y = 60 + i * 45;
        shapes.push(
          `<path d="M320 ${y} Q 420 ${y - 30} 500 ${y} T 620 ${y}" fill="none" stroke="${stroke(0.18 - i * 0.02)}" stroke-width="1.4" />`
        );
      }
  }
  return shapes.join("\n      ");
}

function grain(seed: number, hue: number): string {
  const dots: string[] = [];
  for (let i = 0; i < 40; i++) {
    const x = prand(seed, i * 3) * 600;
    const y = prand(seed, i * 3 + 1) * 300;
    const op = 0.03 + prand(seed, i * 3 + 2) * 0.05;
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1" fill="hsla(${hue},60%,90%,${op.toFixed(2)})" />`);
  }
  return dots.join("");
}

export function generateCoverSvg(opts: { slug: string; categorySlug?: string | null; title: string }): string {
  const seed = hashSeed(opts.slug);
  const hue = CATEGORY_HUES[opts.categorySlug ?? ""] ?? 190 + (seed % 60);
  const accentHue = (hue + 45) % 360;
  const uid = opts.slug.replace(/[^a-z0-9]/g, "").slice(0, 12) || String(seed);

  const mark = opts.title
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return `<svg viewBox="0 0 600 300" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue}, 40%, 6%)" />
        <stop offset="100%" stop-color="hsl(${accentHue}, 50%, 3%)" />
      </linearGradient>
      <filter id="blur-${uid}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="42" />
      </filter>
      <linearGradient id="fade-${uid}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0%" stop-color="hsl(${hue},40%,4%)" stop-opacity="0.9" />
        <stop offset="35%" stop-color="hsl(${hue},40%,4%)" stop-opacity="0" />
      </linearGradient>
    </defs>

    <rect width="600" height="300" fill="url(#bg-${uid})" />
    <g opacity="0.95">${meshBlobs(seed, hue, accentHue, uid)}</g>
    <rect width="600" height="300" fill="hsl(${hue},30%,3%)" opacity="0.14" />

    <g>
      ${foregroundPattern(seed, accentHue)}
    </g>
    <g>${grain(seed, accentHue)}</g>

    <rect width="600" height="300" fill="url(#fade-${uid})" />

    <g transform="translate(30,246)">
      <rect x="0" y="-14" width="20" height="20" rx="5" fill="none" stroke="hsla(${accentHue},80%,75%,0.55)" stroke-width="1.4" />
      <text x="6" y="1" font-family="monospace" font-weight="600" font-size="11" fill="hsla(${accentHue},85%,85%,0.85)">${mark}</text>
      <text x="30" y="1" font-family="monospace" font-size="11" letter-spacing="2" fill="hsla(${hue},70%,80%,0.4)">PROPHEZY</text>
    </g>
  </svg>`;
}
