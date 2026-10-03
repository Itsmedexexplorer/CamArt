import { createContext, useContext, useMemo } from 'react';
import type { TextStyle } from 'react-native';

// Single source of truth for CamArt's visual system.
// Accent colours are the same in both schemes; only the neutrals flip.
const accents = {
  cherry: '#FF625A',
  cobalt: '#4C6FFF',
  lime: '#CFF56A',
  lilac: '#D7C7FF',
  sun: '#FFC93C',
  mint: '#7FDDB4',
  grape: '#6B3FD1',
  gum: '#FF9AD5',
  onAccent: '#182033', // text/icons placed on an accent fill, in either scheme
} as const;

export const palettes = {
  light: {
    ...accents,
    milk: '#F8F7F2', // page background
    ink: '#182033', // primary text
    inkSoft: '#5B6275', // secondary text, 6.1:1 on milk
    paper: '#FFFFFF', // raised surfaces
    sand: '#F3E7D7',
    line: '#ECEAE2',
    wash: '#EFEDE5', // quiet filled surfaces
    // Glassmorphism: translucent frosted surfaces floating over the Ambient colour field.
    glass: 'rgba(255,255,255,0.5)', // cards
    glassSoft: 'rgba(255,255,255,0.55)', // insets inside a glass card (segments, chips, fields)
    glassEdge: 'rgba(255,255,255,0.85)', // bright rim where light catches the pane
  },
  dark: {
    ...accents,
    milk: '#0F1117',
    ink: '#F3F1EA',
    inkSoft: '#A2A8B6', // 7.4:1 on milk
    paper: '#1A1E28',
    sand: '#2A251E',
    line: '#262B37',
    wash: '#222733',
    glass: 'rgba(255,255,255,0.07)',
    glassSoft: 'rgba(255,255,255,0.08)',
    glassEdge: 'rgba(255,255,255,0.13)',
  },
} as const;
export type Palette = { [K in keyof typeof palettes.light]: string };
export type Scheme = keyof typeof palettes;

/** Light palette, for code that must not change with the scheme (sticker rendering, camera chrome). */
export const color = palettes.light;

/** Frosted card: translucent fill plus a light rim. Apply to any surface sitting on the Ambient field. */
export const glass = (c: Palette) => ({ backgroundColor: c.glass, borderWidth: 1, borderColor: c.glassEdge }) as const;
/** An accent tile made of tinted glass (stays readable with onAccent text in both schemes). */
export const tintGlass = (hex: string, scheme: Scheme) => hex + (scheme === 'dark' ? 'D9' : '99');

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 } as const;

export const motion = { press: 120, select: 180, sheet: 300, flash: 80 } as const;
// Elegant settle: close to critically damped, a hint of give, no wobble. Use for every spring.
export const settle = { damping: 26, stiffness: 170, mass: 1 } as const;
// Playful pop: one lively overshoot that settles fast. For things appearing and tactile releases.
export const bouncy = { damping: 12, stiffness: 220, mass: 0.9 } as const;

export const font = {
  display: 'BricolageGrotesque_800ExtraBold', // headings, dates, big numbers
  displaySemi: 'BricolageGrotesque_700Bold',
  ui: 'DMSans_400Regular',
  uiMedium: 'DMSans_500Medium',
  uiBold: 'DMSans_700Bold',
} as const;

const makeType = (c: Palette) =>
  ({
    hero: { fontFamily: font.display, fontSize: 42, lineHeight: 44, letterSpacing: -1.2, color: c.ink },
    title: { fontFamily: font.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.6, color: c.ink },
    body: { fontFamily: font.ui, fontSize: 16, lineHeight: 22, color: c.ink },
    strong: { fontFamily: font.uiBold, fontSize: 16, lineHeight: 22, color: c.ink },
    meta: { fontFamily: font.uiMedium, fontSize: 13, lineHeight: 18, color: c.inkSoft, fontVariant: ['tabular-nums'] },
    label: { fontFamily: font.uiBold, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: c.inkSoft },
  }) satisfies Record<string, TextStyle>;
export type Type = ReturnType<typeof makeType>;

const themes = { light: { c: palettes.light as Palette, ty: makeType(palettes.light) }, dark: { c: palettes.dark as Palette, ty: makeType(palettes.dark) } };

export const SchemeContext = createContext<Scheme>('light');

/** Current palette `c`, type scale `ty` and scheme name. New identities per scheme, so memoised UI updates. */
export function useTheme() {
  const scheme = useContext(SchemeContext);
  return { ...themes[scheme], scheme };
}

/** Per-scheme StyleSheet: `const useStyles = themed((c, t) => StyleSheet.create({...}))`, then `const s = useStyles()`. */
export function themed<T>(make: (c: Palette, t: Type) => T) {
  const cache: Partial<Record<Scheme, T>> = {};
  return function useStyles(): T {
    const scheme = useContext(SchemeContext);
    return useMemo(() => (cache[scheme] ??= make(themes[scheme].c, themes[scheme].ty)), [scheme]);
  };
}

// Soft lift for raised objects (stickers, primary buttons). Not for every surface.
export const lift = {
  shadowColor: '#182033',
  shadowOpacity: 0.16,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;

export const hit = 44; // min touch target
