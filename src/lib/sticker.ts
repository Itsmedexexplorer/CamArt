import {
  AlphaType,
  BlendMode,
  ColorType,
  BlurStyle,
  ClipOp,
  ImageFormat,
  PaintStyle,
  PathOp,
  Skia,
  StrokeJoin,
  type SkCanvas,
  type SkImage,
  type SkPath,
  type SkRect,
  type SkTypeface,
} from '@shopify/react-native-skia';

import { color } from '@/theme';

// Everything here is drawn in a fixed S×S space. Preview scales the canvas
// down; export draws at full size. Same function = what you see is what saves.
export const S = 1440;
export const EXPORT_VERSION = 1;

export const SHAPES = ['stamp', 'polaroid', 'clover', 'flower', 'blossom', 'scallop', 'star', 'heart', 'ticket', 'bubble'] as const;
export type Shape = (typeof SHAPES)[number];
export const SHAPE_LABEL: Record<Shape, string> = {
  stamp: 'Stamp', clover: 'Clover', blossom: 'Blossom', scallop: 'Seal', flower: 'Flower', star: 'Star',
  heart: 'Heart', ticket: 'Ticket', bubble: 'Bubble', polaroid: 'Polaroid',
};

// Sticker edge colours. Each shape has its own character colour as the default edge.
export const EDGES = {
  paper: color.paper, cherry: color.cherry, sun: color.sun, lime: color.lime, mint: color.mint,
  cobalt: color.cobalt, lilac: color.lilac, grape: color.grape, gum: color.gum, ink: color.ink,
} as const;
export type Edge = keyof typeof EDGES;
export const SHAPE_EDGE: Record<Shape, Edge> = {
  stamp: 'paper', clover: 'mint', blossom: 'cherry', scallop: 'grape', flower: 'lilac', star: 'lime',
  heart: 'gum', ticket: 'ink', bubble: 'cobalt', polaroid: 'paper',
};

// Free text the user writes and places anywhere on the sticker. x/y are 0..1 of the sticker.
export type TextSize = 's' | 'm' | 'l';
export type TextItem = { id: string; t: string; x: number; y: number; color: Edge; size: TextSize };
export const TEXT_PX: Record<TextSize, number> = { s: 0.055, m: 0.08, l: 0.115 };

export const FILTERS = ['raw', 'pop', 'honey', 'peach', 'sunset', 'soda', 'ice', 'dream', 'film', 'retro', 'dust', 'noir', 'ink'] as const;
export type Filter = (typeof FILTERS)[number];
export const FILTER_LABEL: Record<Filter, string> = {
  raw: 'Raw', pop: 'Pop', honey: 'Honey', peach: 'Peach', sunset: 'Sunset', soda: 'Soda', ice: 'Ice',
  dream: 'Dream', film: 'Film', retro: 'Retro', dust: 'Dust', noir: 'Noir', ink: 'Ink',
};

export const GRAINS = [0, 0.3, 0.55, 0.85] as const;

export type Look = { shape: Shape; edge: Edge; texts: TextItem[]; cutout?: boolean; filter: Filter; grain: number; caption: string; showDate: boolean; date: Date };

// --- Shapes ---------------------------------------------------------------

const TAU = Math.PI * 2;

/** Closed outline from a unit-radius parametric curve, centred in the box. */
function curve(cx: number, cy: number, R: number, f: (t: number) => [number, number]) {
  const pts = Array.from({ length: 720 }, (_, i) => {
    const [x, y] = f((i / 720) * TAU);
    return { x: cx + x * R, y: cy + y * R };
  });
  return Skia.PathBuilder.Make().addPoly(pts, true).build();
}
const radial = (r: (t: number) => number) => (t: number): [number, number] => [r(t) * Math.cos(t), r(t) * Math.sin(t)];

// Radius profiles, all peaking at 1. Start at the top (-90°) so shapes sit upright.
const up = (t: number) => t + Math.PI / 2;
const cookie = (n: number, d: number) => radial((t) => 1 - d + d * (0.5 + 0.5 * Math.cos(n * up(t))));
const rays = (n: number, d: number, sharp: number) => radial((t) => 1 - d + d * Math.pow(0.5 + 0.5 * Math.cos(n * up(t)), sharp));
const op = (a: SkPath, b: SkPath, o: PathOp) => Skia.Path.MakeFromOp(a, b, o) ?? a;

/** Puffy lobes: n circles on a ring, unioned with a centre disc (Material clover/flower). */
function lobes(cx: number, cy: number, R: number, n: number, lobe: number) {
  let p = Skia.Path.Circle(cx, cy, R * (1 - lobe));
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * TAU) / n;
    p = op(p, Skia.Path.Circle(cx + (1 - lobe) * R * Math.cos(a), cy + (1 - lobe) * R * Math.sin(a), R * lobe), PathOp.Union);
  }
  return p;
}

/** Shape outline inside box (x, y, w) — box is square. */
export function shapePath(shape: Shape, x: number, y: number, w: number): SkPath {
  const cx = x + w / 2, cy = y + w / 2, R = w / 2;
  const rr = (rx: number, ry: number, rw: number, rh: number, rad: number) => Skia.Path.RRect(Skia.RRectXY(Skia.XYWHRect(rx, ry, rw, rh), rad, rad));
  const circle = (ccx: number, ccy: number, r: number) => Skia.Path.Circle(ccx, ccy, r);
  const c = (f: (t: number) => [number, number], s = 1) => curve(cx, cy, R * s, f);
  switch (shape) {
    case 'stamp': {
      // Postage stamp: portrait card with perforation bites on every edge.
      const sw = w * 0.84, sx = cx - sw / 2, r = w * 0.027, gap = r * 2.7;
      let holes = Skia.Path.Make();
      const edge = (x0: number, y0: number, x1: number, y1: number) => {
        const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / gap);
        for (let i = 0; i <= n; i++) holes = op(holes, circle(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r), PathOp.Union);
      };
      edge(sx, y, sx + sw, y);
      edge(sx, y + w, sx + sw, y + w);
      edge(sx, y, sx, y + w);
      edge(sx + sw, y, sx + sw, y + w);
      return op(Skia.Path.Rect(Skia.XYWHRect(sx, y, sw, w)), holes, PathOp.Difference);
    }
    case 'clover': return lobes(cx, cy, R, 4, 0.47); // four-leaf: big round leaves
    case 'blossom': return lobes(cx, cy, R, 8, 0.3);
    case 'scallop': return c(cookie(12, 0.07));
    case 'flower': return lobes(cx, cy, R, 6, 0.36);
    case 'star': return c(rays(5, 0.44, 1.1), 1.04);
    case 'heart':
      return c((t) => {
        const s = Math.sin(t);
        return [(16 * s * s * s) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 - 0.1];
      }, 1.04);
    case 'ticket': {
      const h = w * 0.64, top = cy - h / 2;
      const p = rr(x, top, w, h, w * 0.05);
      return op(op(p, circle(x, cy, w * 0.07), PathOp.Difference), circle(x + w, cy, w * 0.07), PathOp.Difference);
    }
    case 'bubble': {
      const h = w * 0.8;
      const tail = Skia.PathBuilder.Make()
        .addPoly([{ x: x + w * 0.2, y: y + h - w * 0.1 }, { x: x + w * 0.12, y: y + w }, { x: x + w * 0.44, y: y + h - w * 0.02 }], true)
        .build();
      return op(rr(x, y, w, h, w * 0.24), tail, PathOp.Union);
    }
    case 'polaroid': return rr(x + w * 0.08, y, w * 0.84, w, w * 0.012);
  }
}

/** Where the photo shows. Stamp keeps a paper margin inside its perforations; Polaroid has its window. */
export function windowPath(shape: Shape, x: number, y: number, w: number): SkPath {
  if (shape === 'stamp') {
    const sx = x + w * 0.08;
    return Skia.Path.Rect(Skia.XYWHRect(sx + w * 0.075, y + w * 0.075, w * 0.84 - w * 0.15, w - w * 0.15));
  }
  if (shape === 'polaroid') return Skia.Path.Rect(Skia.XYWHRect(x + w * 0.13, y + w * 0.05, w * 0.74, w * 0.74));
  return shapePath(shape, x, y, w);
}

// --- Filters --------------------------------------------------------------

function matrix(sat: number, contrast: number, lift: number, tint: [number, number, number] = [0, 0, 0]) {
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
  const sr = (1 - sat) * lr, sg = (1 - sat) * lg, sb = (1 - sat) * lb;
  const off = (1 - contrast) / 2 + lift;
  const c = contrast;
  return [
    c * (sr + sat), c * sg, c * sb, 0, off + tint[0],
    c * sr, c * (sg + sat), c * sb, 0, off + tint[1],
    c * sr, c * sg, c * (sb + sat), 0, off + tint[2],
    0, 0, 0, 1, 0,
  ];
}

export const FILTER_MATRIX: Record<Filter, number[]> = {
  raw: matrix(1, 1, 0),
  pop: matrix(1.45, 1.12, 0),
  honey: matrix(1.1, 1.05, 0.01, [0.06, 0.02, -0.05]),
  peach: matrix(1.05, 0.98, 0.03, [0.07, 0.01, 0.02]),
  sunset: matrix(1.25, 1.08, 0, [0.09, -0.01, -0.07]),
  soda: matrix(1.05, 1.05, 0, [-0.04, 0.02, 0.07]),
  ice: matrix(0.85, 1.05, 0.02, [-0.05, 0.01, 0.09]),
  dream: matrix(0.9, 0.85, 0.06, [0.04, -0.01, 0.08]),
  film: matrix(0.85, 0.92, 0.04, [0.02, 0.04, -0.02]),
  retro: matrix(0.55, 0.95, 0.03, [0.09, 0.04, -0.04]),
  dust: matrix(0.7, 0.82, 0.05, [0.02, 0.01, 0]),
  noir: matrix(0, 1.45, -0.03),
  ink: matrix(0, 1.2, 0),
};

// --- Grain ----------------------------------------------------------------

export const grainEffect = Skia.RuntimeEffect.Make(`
uniform float seed;
half4 main(float2 p) {
  float2 q = mod(floor(p / 2.0), 512.0);
  float n = fract(sin(dot(q, float2(12.9898, 78.233)) + seed) * 43758.5453);
  return half4(half3(n), 1.0);
}`)!;

// --- Draw -----------------------------------------------------------------

export function stampText(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `'${p(d.getFullYear() % 100)} ${p(d.getMonth() + 1)} ${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const paint = (hex: string) => {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(hex));
  return p;
};

/** Draws the full sticker into an S×S canvas. `photo` is the S×S square crop. */
export function drawSticker(canvas: SkCanvas, photo: SkImage, look: Look, typeface: SkTypeface | null, lifted?: SkImage | null) {
  if (look.cutout && lifted) return drawCutout(canvas, lifted, look, typeface);
  const m = S * 0.1, w = S - 2 * m;
  const path = shapePath(look.shape, m, m, w);
  const win = windowPath(look.shape, m, m, w);
  const outer = path.computeTightBounds();
  const b = win.computeTightBounds();

  // Die-cut edge in the chosen colour. No baked shadow or dark rim: the sticker is just the object.
  const edge = paint(EDGES[look.edge] ?? color.paper);
  edge.setStyle(PaintStyle.Stroke);
  edge.setStrokeJoin(StrokeJoin.Round);
  // Paper objects (stamp, polaroid) are their own edge: a thick die-cut stroke would fill the perforations.
  const paperObject = look.shape === 'stamp' || look.shape === 'polaroid';
  edge.setStrokeWidth(paperObject ? 1 : S * 0.055);
  canvas.drawPath(path, edge);
  edge.setStyle(PaintStyle.Fill);
  canvas.drawPath(path, edge); // paper/colour body: shows as the stamp margin and polaroid card
  if (paperObject) {
    // Faint hairline so white paper still reads on light backgrounds.
    const hair = paint('rgba(24,32,51,0.14)');
    hair.setStyle(PaintStyle.Stroke);
    hair.setStrokeWidth(S * 0.002);
    canvas.drawPath(path, hair);
  }

  // Photo, clipped to the window.
  canvas.save();
  canvas.clipPath(win, ClipOp.Intersect, true);
  const img = Skia.Paint();
  img.setColorFilter(Skia.ColorFilter.MakeMatrix(FILTER_MATRIX[look.filter]));
  canvas.drawImageRect(photo, Skia.XYWHRect(0, 0, photo.width(), photo.height()), Skia.XYWHRect(0, 0, S, S), img);

  if (look.grain > 0) {
    const g = Skia.Paint();
    g.setShader(grainEffect.makeShader([7.31]));
    g.setBlendMode(BlendMode.Overlay);
    g.setAlphaf(look.grain * 0.6);
    canvas.drawRect(b, g);
  }

  if (look.shape === 'polaroid') {
    // Photo sits slightly recessed in the card: a soft shade along the top edge.
    const sh = Skia.Paint();
    sh.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: b.y }, { x: 0, y: b.y + S * 0.035 }, [Skia.Color('rgba(0,0,0,0.22)'), Skia.Color('rgba(0,0,0,0)')], null, 0));
    canvas.drawRect(b, sh);
  }

  if (look.showDate && typeface) {
    const f = Skia.Font(typeface, S * 0.045);
    const t = stampText(look.date);
    const tx = b.x + b.width / 2 - f.getTextWidth(t) / 2;
    const ty = b.y + b.height * (look.shape === 'heart' ? 0.5 : look.caption.trim() && look.shape !== 'polaroid' ? 0.62 : 0.8); // inside the shape, clear of the caption
    const shade = paint('rgba(24,32,51,0.45)'); // keeps the stamp legible on bright photos
    shade.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, S * 0.004, true));
    canvas.drawText(t, tx, ty + S * 0.003, shade, f);
    const glow = paint('#FF8A3D');
    glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, S * 0.006, true));
    canvas.drawText(t, tx, ty, glow, f);
    canvas.drawText(t, tx, ty, paint('#FFB27A'), f);
  }
  canvas.restore();

  if (look.shape === 'stamp') {
    // Printed keyline just outside the picture, like a real stamp's frame line.
    const k = paint(color.ink);
    k.setStyle(PaintStyle.Stroke);
    k.setStrokeWidth(S * 0.003);
    k.setAlphaf(0.35);
    const g = S * 0.012;
    canvas.drawRect(Skia.XYWHRect(b.x - g, b.y - g, b.width + 2 * g, b.height + 2 * g), k);
  }

  const caption = look.caption.trim();
  if (caption && typeface) {
    if (look.shape === 'polaroid') drawMarginNote(canvas, caption, outer, b, typeface);
    else drawLabel(canvas, caption, b, typeface);
  }
  if (typeface) for (const t of look.texts) drawFreeText(canvas, t, typeface);
}

/** Size of a free text item in S space, for hit boxes and drawing. */
export function textMetrics(t: TextItem, typeface: SkTypeface) {
  const size = S * TEXT_PX[t.size];
  return { size, width: Skia.Font(typeface, size).getTextWidth(t.t), height: size * 1.2 };
}

/** Free text: bold, die-cut outlined so it reads on any photo, slightly tilted like a sticker. */
function drawFreeText(canvas: SkCanvas, t: TextItem, typeface: SkTypeface) {
  if (!t.t.trim()) return;
  const { size, width } = textMetrics(t, typeface);
  const f = Skia.Font(typeface, size);
  const cx = t.x * S, cy = t.y * S;
  const fill = EDGES[t.color] ?? color.ink;
  const outline = paint(t.color === 'paper' || t.color === 'lime' || t.color === 'sun' ? color.ink : color.paper);
  outline.setStyle(PaintStyle.Stroke);
  outline.setStrokeJoin(StrokeJoin.Round);
  outline.setStrokeWidth(size * 0.22);
  canvas.save();
  canvas.rotate(-4, cx, cy);
  canvas.drawText(t.t, cx - width / 2, cy + size * 0.35, outline, f);
  canvas.drawText(t.t, cx - width / 2, cy + size * 0.35, paint(fill), f);
  canvas.restore();
}

/** Polaroid caption: written on the card's thick bottom margin, like a marker note. */
function drawMarginNote(canvas: SkCanvas, text: string, card: SkRect, win: SkRect, typeface: SkTypeface) {
  const f = Skia.Font(typeface, S * 0.06);
  let tw = f.getTextWidth(text);
  if (tw > card.width * 0.86) {
    f.setSize((S * 0.06 * card.width * 0.86) / tw);
    tw = f.getTextWidth(text);
  }
  const cy = (win.y + win.height + card.y + card.height) / 2;
  canvas.save();
  canvas.rotate(-2, card.x + card.width / 2, cy);
  canvas.drawText(text, card.x + card.width / 2 - tw / 2, cy + f.getSize() * 0.35, paint(color.ink), f);
  canvas.restore();
}

/**
 * Lifted subject as the sticker itself: a die-cut border that follows the subject's outline
 * (its alpha, dilated), then the subject with the chosen filter, then stamp, label and text.
 */
function drawCutout(canvas: SkCanvas, subject: SkImage, look: Look, typeface: SkTypeface | null) {
  const src = Skia.XYWHRect(0, 0, subject.width(), subject.height());
  const dst = Skia.XYWHRect(S * 0.06, S * 0.06, S * 0.88, S * 0.88);
  const border = Skia.Paint();
  border.setImageFilter(
    Skia.ImageFilter.MakeColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(EDGES[look.edge] ?? color.paper), BlendMode.SrcIn), Skia.ImageFilter.MakeDilate(S * 0.028, S * 0.028)),
  );
  canvas.drawImageRect(subject, src, dst, border);
  const img = Skia.Paint();
  img.setColorFilter(Skia.ColorFilter.MakeMatrix(FILTER_MATRIX[look.filter]));
  canvas.drawImageRect(subject, src, dst, img);
  if (look.showDate && typeface) {
    const f = Skia.Font(typeface, S * 0.045);
    const t = stampText(look.date);
    const tx = S / 2 - f.getTextWidth(t) / 2, ty = S * 0.93;
    canvas.drawText(t, tx, ty + S * 0.003, paint('rgba(24,32,51,0.45)'), f);
    canvas.drawText(t, tx, ty, paint('#FF8A3D'), f);
  }
  const caption = look.caption.trim();
  if (caption && typeface) drawLabel(canvas, caption, Skia.XYWHRect(S * 0.1, S * 0.1, S * 0.8, S * 0.7), typeface);
  if (typeface) for (const t of look.texts) drawFreeText(canvas, t, typeface);
}

function drawLabel(canvas: SkCanvas, text: string, b: SkRect, typeface: SkTypeface) {
  let size = S * 0.06;
  const f = Skia.Font(typeface, size);
  let tw = f.getTextWidth(text);
  if (tw > S * 0.7) {
    size *= (S * 0.7) / tw;
    f.setSize(size);
    tw = f.getTextWidth(text);
  }
  const padX = size * 0.7, h = size * 1.7;
  const lw = tw + padX * 2;
  const cx = S / 2, cy = Math.min(b.y + b.height - h * 0.15, S - h * 0.8);
  const rect = Skia.RRectXY(Skia.XYWHRect(cx - lw / 2, cy - h / 2, lw, h), h / 2, h / 2);

  canvas.save();
  canvas.rotate(-3, cx, cy);
  const ink = paint(color.ink);
  canvas.save();
  canvas.translate(0, S * 0.006);
  canvas.drawRRect(rect, ink); // offset print shadow
  canvas.restore();
  canvas.drawRRect(rect, paint(color.sand));
  const stroke = paint(color.ink);
  stroke.setStyle(PaintStyle.Stroke);
  stroke.setStrokeWidth(S * 0.004);
  canvas.drawRRect(rect, stroke);
  canvas.drawText(text, cx - tw / 2, cy + size * 0.35, ink, f);
  canvas.restore();
}

// --- Source + export ------------------------------------------------------

export type Crop = { cy: number; frac: number }; // center y and side, as fractions of photo height

/** Decode the original and cut the square the camera guide showed, at S×S. */
export async function loadCrop(uri: string, crop: Crop): Promise<SkImage> {
  const src = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!src) throw new Error('Could not decode photo');
  const W = src.width(), H = src.height();
  const side = Math.min(W, H, crop.frac * H);
  const top = Math.min(Math.max(crop.cy * H - side / 2, 0), H - side);
  const surface = Skia.Surface.MakeOffscreen(S, S)!;
  surface.getCanvas().drawImageRect(src, Skia.XYWHRect((W - side) / 2, top, side, side), Skia.XYWHRect(0, 0, S, S), Skia.Paint());
  surface.flush();
  const out = surface.makeImageSnapshot().makeNonTextureImage();
  if (!out) throw new Error('Could not prepare photo');
  return out;
}

/**
 * Prepares a lifted subject (transparent PNG from the native segmenter) as a sticker:
 * finds where the subject actually is, trims the empty space around it and centres it in
 * the square, so the whole subject is kept and fills the sticker instead of floating tiny
 * or being cut off by the camera frame.
 */
export async function loadSubject(uri: string): Promise<SkImage> {
  const src = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!src) throw new Error('Could not read the lifted subject');
  const W = src.width(), H = src.height();

  // Find the subject's bounds on a small copy (fast), then map back to full size.
  const k = Math.min(1, 256 / Math.max(W, H));
  const sw = Math.max(1, Math.round(W * k)), sh = Math.max(1, Math.round(H * k));
  const small = Skia.Surface.MakeOffscreen(sw, sh)!;
  small.getCanvas().drawImageRect(src, Skia.XYWHRect(0, 0, W, H), Skia.XYWHRect(0, 0, sw, sh), Skia.Paint());
  small.flush();
  const px = small.makeImageSnapshot().readPixels(0, 0, { width: sw, height: sh, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  if (px) {
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++)
        if (px[(y * sw + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
  }
  if (x1 < 0) throw new Error('No clear subject found in this photo. Try one with a person, pet or object up close.');

  const bx = x0 / k, by = y0 / k, bw = (x1 - x0 + 1) / k, bh = (y1 - y0 + 1) / k;
  const fit = S / Math.max(bw, bh); // contain: the longer side spans the square
  const dw = bw * fit, dh = bh * fit;
  const out = Skia.Surface.MakeOffscreen(S, S)!;
  out.getCanvas().drawImageRect(src, Skia.XYWHRect(bx, by, bw, bh), Skia.XYWHRect((S - dw) / 2, (S - dh) / 2, dw, dh), Skia.Paint());
  out.flush();
  const img = out.makeImageSnapshot().makeNonTextureImage();
  if (!img) throw new Error('Could not prepare the lifted subject');
  return img;
}

/** Render the final sticker to PNG bytes (transparent outside the die-cut). */
export function renderSticker(photo: SkImage, look: Look, typeface: SkTypeface | null, lifted?: SkImage | null): Uint8Array {
  const surface = Skia.Surface.MakeOffscreen(S, S);
  if (!surface) throw new Error('Could not create render surface');
  drawSticker(surface.getCanvas(), photo, look, typeface, lifted);
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
}
