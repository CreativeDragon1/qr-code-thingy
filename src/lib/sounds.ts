"use client";

/**
 * The two mp3s are supplied by the club and are not in version control.
 * Every path here is best-effort: a missing or blocked file must never stop a
 * scan from being recorded.
 */
const SOURCES = {
  success: "/sfx/mogo.mp3",
  failure: "/sfx/mono.mp3",
} as const;

export type SoundKind = keyof typeof SOURCES;

const players: Partial<Record<SoundKind, HTMLAudioElement>> = {};

function get(kind: SoundKind): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!players[kind]) {
    const audio = new Audio(SOURCES[kind]);
    audio.preload = "auto";
    audio.addEventListener("error", () => {
      console.warn(`Missing sound file ${SOURCES[kind]} — continuing silently.`);
    });
    players[kind] = audio;
  }
  return players[kind] ?? null;
}

/**
 * Browsers refuse to play audio until the page has had a user gesture. Call
 * this from the tap that starts the scanner so the first real scan is audible.
 */
export function primeSounds(): void {
  (Object.keys(SOURCES) as SoundKind[]).forEach((kind) => {
    const audio = get(kind);
    if (!audio) return;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
      })
      .catch(() => {
        audio.volume = 1;
      });
  });
}

export function playSound(kind: SoundKind): void {
  const audio = get(kind);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    /* no sound is an acceptable degradation */
  }
}

/** Short buzz on failure, double tap on success. Silently absent on desktop. */
export function vibrate(kind: SoundKind): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(kind === "success" ? [24, 40, 24] : [120, 60, 120]);
}
