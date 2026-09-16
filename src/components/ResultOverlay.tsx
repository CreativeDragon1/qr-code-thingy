"use client";

import { useEffect } from "react";
import type { ScanResponse } from "@/lib/qr";
import styles from "./ResultOverlay.module.css";

const SUCCESS_MS = 1900;
const FAILURE_MS = 2900;

function headline(result: ScanResponse): string {
  const food = result.mode === "food";
  switch (result.result) {
    case "success":
      return food ? "Food collected" : "Checked in";
    case "already_used":
      return food ? "Food already taken" : "Already checked in";
    case "not_found":
      return "Not on the list";
    case "invalid_format":
      return "Invalid code";
  }
}

function detail(result: ScanResponse): string | null {
  switch (result.result) {
    case "already_used": {
      if (!result.usedAt) return "This code has already been used.";
      const when = new Date(result.usedAt);
      const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return result.mode === "food"
        ? `Food was already collected at ${time}.`
        : `Already checked in at ${time}.`;
    }
    case "not_found":
      return "This ID is not in the attendee list. Send them to the help desk.";
    case "invalid_format":
      return "That is not an event QR code. Nothing was looked up.";
    default:
      return null;
  }
}

export default function ResultOverlay({
  result,
  onDismiss,
}: {
  result: ScanResponse;
  onDismiss: () => void;
}) {
  const ok = result.result === "success";
  const duration = ok ? SUCCESS_MS : FAILURE_MS;

  useEffect(() => {
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [duration, onDismiss]);

  const note = detail(result);

  return (
    <div
      className={`${styles.overlay} ${ok ? styles.success : styles.failure}`}
      onClick={onDismiss}
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.timer} style={{ animationDuration: `${duration}ms` }} />

      <div className={styles.head}>
        <span className={`eyebrow ${styles.headLabel}`}>
          {result.mode === "food" ? "Food collection" : "Registration"}
        </span>
        <span className={`eyebrow ${styles.headLabel}`}>{ok ? "Accepted" : "Rejected"}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.glyph} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            {ok ? <path d="M4 12.8 9.2 18 20 6.6" /> : <path d="M6 6l12 12M18 6L6 18" />}
          </svg>
        </div>

        <h1 className={`display ${styles.status}`}>{headline(result)}</h1>

        {result.attendee ? (
          <div className={styles.person}>
            <div className={styles.name}>{result.attendee.name}</div>
            <div className={styles.email}>{result.attendee.email}</div>
            {note ? <div className={styles.detail}>{note}</div> : null}
          </div>
        ) : note ? (
          <div className={styles.person}>
            <div className={styles.detail}>{note}</div>
          </div>
        ) : null}
      </div>

      <div className={styles.foot}>
        <span className={`mono ${styles.idTag}`}>{result.idnum ?? "—"}</span>
        <span className={`eyebrow ${styles.dismiss}`}>Tap to continue</span>
      </div>
    </div>
  );
}
