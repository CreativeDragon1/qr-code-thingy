"use client";

import { useState } from "react";
import { api, setPassword } from "@/lib/client";
import styles from "./PasswordGate.module.css";

/**
 * Staff type the shared password once per device. It is verified by calling a
 * real endpoint rather than compared in the browser, so the password never
 * ships to the client.
 */
export default function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    setPassword(value);

    try {
      await api("/api/session");
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.mark} aria-hidden="true">
          SS
        </div>
        <div>
          <h1 className={`display ${styles.title}`}>Staff access</h1>
          <p className={styles.text}>
            Enter the shared event password. This device will remember it.
          </p>
        </div>

        <div className={styles.field}>
          <label className="eyebrow" htmlFor="pw">
            Password
          </label>
          <input
            id="pw"
            className={styles.input}
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <button className={styles.button} type="submit" disabled={checking || !value}>
          {checking ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
