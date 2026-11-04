/**
 * Speech on this computer. Output uses the voices installed here (localService only). Dictation uses
 * the browser's speech recognition, which in Chromium-based browsers can send audio to the browser
 * vendor's service, so the app never starts it without the employee's explicit opt-in.
 */
export type SpeakResult = { ok: true } | { ok: false; reason: 'unsupported' | 'no-local-voice' };

export function localVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.localService);
}

export function speakText(text: string): SpeakResult {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return { ok: false, reason: 'unsupported' };
  const voices = localVoices();
  if (!voices.length) return { ok: false, reason: 'no-local-voice' };
  const lang = (document.documentElement.lang || 'en').slice(0, 2);
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? voices[0]!;
  u.lang = u.voice.lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return { ok: true };
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export interface Dictation { start(): void; stop(): void }

/** Returns null when this browser has no speech recognition: the caller then offers typing only. */
export function startDictation(onText: (text: string) => void, onEnd: () => void): Dictation | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = (document.documentElement.lang || 'en-US');
  rec.continuous = false;
  rec.interimResults = false;
  rec.onresult = (e) => { const t = e.results?.[0]?.[0]?.transcript; if (t) onText(String(t)); };
  rec.onend = () => onEnd();
  rec.onerror = () => onEnd();
  return { start: () => rec.start(), stop: () => rec.stop() };
}

interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
}
