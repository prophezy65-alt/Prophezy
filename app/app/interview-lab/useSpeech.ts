/**
 * app/app/interview-lab/useSpeech.ts
 *
 * Browser text-to-speech wrapper for the cartoon interviewer. Uses the native
 * Web Speech API (speechSynthesis) — free, offline, no backend.
 *
 * Language-aware: it detects the script of the text (e.g. Devanagari → Hindi)
 * and picks a matching installed voice + sets utterance.lang, so viva/interview
 * questions in Hindi, Tamil, Arabic, etc. are actually spoken instead of going
 * silent under an English-only voice. Prefers a female voice where possible.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FEMALE_HINTS = [
  "female",
  "zira",
  "samantha",
  "susan",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "kalpana",
  "swara",
  "google",
];

/** Detects a BCP-47 language tag from the script of the text. */
function detectLang(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Devanagari (Hindi/Marathi)
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN"; // Gurmukhi (Punjabi)
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN"; // Gujarati
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN"; // Telugu
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN"; // Malayalam
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA"; // Arabic
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN"; // Chinese
  if (/[\u3040-\u30FF]/.test(text)) return "ja-JP"; // Japanese
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko-KR"; // Korean
  if (/[\u0400-\u04FF]/.test(text)) return "ru-RU"; // Cyrillic
  return "en-US";
}

/**
 * Picks the best installed voice for a language tag. Falls back to any voice
 * sharing the base language (e.g. "hi"), then to a female English voice, then
 * to whatever exists.
 */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const base = lang.split("-")[0]?.toLowerCase() ?? "en";

  const exact = voices.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
  const sameBase = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const preferFemale = (pool: SpeechSynthesisVoice[]) =>
    pool.find((v) => FEMALE_HINTS.some((h) => v.name.toLowerCase().includes(h))) ?? pool[0] ?? null;

  if (exact.length > 0) return preferFemale(exact);
  if (sameBase.length > 0) return preferFemale(sameBase);

  // No voice for that language installed → fall back to English so at least
  // something is spoken (browsers vary on how they render foreign scripts).
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (english.length > 0) return preferFemale(english);
  return voices[0] ?? null;
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) voicesRef.current = voices;
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speakNow = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Voices can load lazily; if empty, refresh once before speaking.
    if (voicesRef.current.length === 0) {
      voicesRef.current = window.speechSynthesis.getVoices();
    }

    const lang = detectLang(text);
    const voice = pickVoice(voicesRef.current, lang);

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    utterance.rate = 0.98;
    utterance.pitch = 1.05;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (mutedRef.current || !text.trim()) return;
      // If voices aren't ready yet, wait for them once, then speak.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.getVoices().length === 0) {
          const once = () => {
            window.speechSynthesis.onvoiceschanged = null;
            voicesRef.current = window.speechSynthesis.getVoices();
            speakNow(text);
          };
          window.speechSynthesis.onvoiceschanged = once;
          // Fallback in case the event never fires.
          setTimeout(() => speakNow(text), 250);
          return;
        }
      }
      speakNow(text);
    },
    [speakNow],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (next && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
      return next;
    });
  }, []);

  return { supported, speaking, muted, speak, stop, toggleMute };
}
