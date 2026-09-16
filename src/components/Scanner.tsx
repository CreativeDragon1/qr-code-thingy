"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { api, AuthError, getMode, setMode as persistMode } from "@/lib/client";
import { buildQrPayload, type ScanMode, type ScanResponse } from "@/lib/qr";
import { playSound, primeSounds, vibrate } from "@/lib/sounds";
import ResultOverlay from "./ResultOverlay";
import styles from "./Scanner.module.css";

type Phase = "idle" | "starting" | "scanning" | "denied";

/** Ignore repeat decodes of the same code while it is still in frame. */
const REPEAT_COOLDOWN_MS = 3500;

export default function Scanner({ onAuthError }: { onAuthError: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number } | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<ScanMode>("registration");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualId, setManualId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ registration: 0, food: 0 });

  // Mode is per-device, so it is read from localStorage after mount rather than
  // rendered on the server.
  useEffect(() => setMode(getMode()), []);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const submit = useCallback(
    async (code: string) => {
      // The ref is the synchronous guard against a second decode landing before
      // React re-renders; the state only drives the spinner.
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        const scanMode = modeRef.current;
        const res = await api<ScanResponse>("/api/scan", {
          method: "POST",
          body: JSON.stringify({ code, mode: scanMode }),
        });

        const ok = res.result === "success";
        playSound(ok ? "success" : "failure");
        vibrate(ok ? "success" : "failure");
        if (ok) {
          setCounts((c) => ({ ...c, [scanMode]: c[scanMode] + 1 }));
        }
        setResult(res);
      } catch (err) {
        if (err instanceof AuthError) {
          onAuthError();
        } else {
          playSound("failure");
          setError(err instanceof Error ? err.message : "Scan failed.");
        }
        busyRef.current = false;
      } finally {
        setBusy(false);
      }
    },
    [onAuthError],
  );

  const dismiss = useCallback(() => {
    setResult(null);
    busyRef.current = false;
  }, []);

  const start = useCallback(async () => {
    setPhase("starting");
    setError(null);
    primeSounds();

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();

      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current ?? undefined,
        (decoded) => {
          if (!decoded) return;
          const text = decoded.getText();
          const now = Date.now();
          const last = lastRef.current;
          if (last && last.code === text && now - last.at < REPEAT_COOLDOWN_MS) return;
          lastRef.current = { code: text, at: now };
          void submit(text);
        },
      );

      controlsRef.current = controls;
      setPhase("scanning");
    } catch (err) {
      console.error(err);
      setPhase("denied");
      setError(
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera access was blocked. Allow it in your browser settings, or enter IDs by hand."
          : "Could not open the camera. Enter IDs by hand instead.",
      );
      setManualOpen(true);
    }
  }, [submit]);

  useEffect(() => {
    return () => controlsRef.current?.stop();
  }, []);

  function chooseMode(next: ScanMode) {
    setMode(next);
    persistMode(next);
    lastRef.current = null;
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const id = manualId.trim();
    if (!id) return;
    setManualId("");
    void submit(buildQrPayload(id));
  }

  const liveCount = counts[mode];

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.mark} aria-hidden="true">
            SS
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>Sustainability Sphere</span>
            <span className="eyebrow">
              {mode === "food" ? "Food collection" : "Registration"}
            </span>
          </div>
        </div>
        <div className={styles.counter}>
          <div className={`mono ${styles.counterValue}`}>{liveCount}</div>
          <span className="eyebrow">This device</span>
        </div>
      </header>

      <div className={styles.stage}>
        <video
          ref={videoRef}
          className={`${styles.video} ${phase === "scanning" ? "" : styles.hidden}`}
          muted
          playsInline
          autoPlay
        />

        {phase === "scanning" ? (
          <div className={styles.reticle} aria-hidden="true">
            <span className={`${styles.corner} ${styles.tl}`} />
            <span className={`${styles.corner} ${styles.tr}`} />
            <span className={`${styles.corner} ${styles.bl}`} />
            <span className={`${styles.corner} ${styles.br}`} />
            <span className={styles.scanline} />
          </div>
        ) : null}

        {phase === "idle" ? (
          <div className={styles.cover}>
            <h1 className={`display ${styles.coverTitle}`}>Ready to scan</h1>
            <p className={styles.coverText}>
              Pick a mode below, then start the camera. Your browser will ask for
              camera permission once.
            </p>
            <button className={styles.start} onClick={start}>
              Start camera
            </button>
          </div>
        ) : null}

        {phase === "starting" ? (
          <div className={styles.cover}>
            <div className={styles.spinner} />
            <p className={styles.coverText}>Waiting for the camera…</p>
          </div>
        ) : null}

        {phase === "denied" ? (
          <div className={styles.cover}>
            <h1 className={`display ${styles.coverTitle}`}>No camera</h1>
            <p className={styles.coverText}>{error}</p>
            <button className={styles.retry} onClick={start}>
              Try again
            </button>
          </div>
        ) : null}

        {phase === "scanning" && busy && !result ? (
          <div className={styles.busy}>
            <div className={styles.spinner} />
          </div>
        ) : null}
      </div>

      <div className={styles.controls}>
        <div className={styles.toggle} role="radiogroup" aria-label="Scanner mode">
          <button
            role="radio"
            aria-checked={mode === "registration"}
            className={`${styles.segment} ${mode === "registration" ? styles.segmentActive : ""}`}
            onClick={() => chooseMode("registration")}
          >
            Registration
          </button>
          <button
            role="radio"
            aria-checked={mode === "food"}
            className={`${styles.segment} ${mode === "food" ? styles.segmentActiveFood : ""}`}
            onClick={() => chooseMode("food")}
          >
            Food collection
          </button>
        </div>

        {manualOpen ? (
          <form className={styles.manual} onSubmit={submitManual}>
            <input
              className={styles.input}
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Attendee ID, e.g. 10423"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Attendee ID"
            />
            <button className={styles.submit} type="submit" disabled={!manualId.trim()}>
              Submit
            </button>
          </form>
        ) : null}

        <div className={styles.subRow}>
          <button className={styles.link} onClick={() => setManualOpen((v) => !v)}>
            {manualOpen ? "Hide manual entry" : "Enter an ID by hand"}
          </button>
          <a className={styles.link} href="/admin">
            Admin
          </a>
        </div>

        {error && phase !== "denied" ? <p className={styles.error}>{error}</p> : null}
      </div>

      {result ? <ResultOverlay result={result} onDismiss={dismiss} /> : null}
    </div>
  );
}
