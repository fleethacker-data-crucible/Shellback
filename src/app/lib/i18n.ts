/**
 * Localisation scaffold. Messages live in one catalogue per locale; English is the source and the
 * fallback for any key a locale does not yet translate. The only locales shipped are `en` (the source)
 * and `en-XA`, a pseudo-locale that wraps every English string so that clipped or hard-coded text shows
 * up at once. No other language is claimed: a translation needs a native-speaker review before it ships.
 */
export const LOCALES = ['en', 'en-XA'] as const;
export type Locale = (typeof LOCALES)[number];

const en = {
  'app.skip': 'Skip to content',
  'nav.home': 'Home',
  'nav.profile': 'My profile',
  'nav.explore': 'Explore',
  'nav.team': 'Team',
  'nav.program': 'Program',
} as const;

export type MessageKey = keyof typeof en;

/** Pseudo-localisation: `[` and `]` around each English string, and a longer tail so layout expansion is visible. */
const pseudo = Object.fromEntries(Object.entries(en).map(([k, v]) => [k, `[${v} ~~~]`])) as Record<MessageKey, string>;

const catalogs: Record<Locale, Partial<Record<MessageKey, string>>> = { en, 'en-XA': pseudo };

let current: Locale = 'en';

export function parseLocale(v: unknown): Locale {
  return (LOCALES as readonly unknown[]).includes(v) ? (v as Locale) : 'en';
}

/** Set the active locale and tell the page its language. */
export function setLocale(v: unknown): Locale {
  current = parseLocale(v);
  if (typeof document !== 'undefined') document.documentElement.lang = current === 'en-XA' ? 'en' : current;
  return current;
}

export const currentLocale = (): Locale => current;

/** Look up a message in the active locale, falling back to English; `{name}` placeholders are filled from `vars`. */
export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const msg = catalogs[current][key] ?? en[key];
  return msg.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

/** Keys a locale has not translated yet (the English fallback is used for them). */
export function missingKeys(locale: Locale): MessageKey[] {
  return (Object.keys(en) as MessageKey[]).filter((k) => !catalogs[locale][k]);
}

export const navKey = (id: string): MessageKey => `nav.${id}` as MessageKey;
