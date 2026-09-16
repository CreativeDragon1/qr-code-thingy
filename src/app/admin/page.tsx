"use client";

import { useCallback, useEffect, useState } from "react";
import PasswordGate from "@/components/PasswordGate";
import { api, AuthError } from "@/lib/client";
import styles from "./Admin.module.css";

type Row = {
  idnum: string;
  name: string;
  email: string;
  registered_at: string | null;
  food_collected_at: string | null;
  qr_sent_at: string | null;
};

type Stats = { total: number; registered: number; fed: number; unsent: number };

type SendResult = {
  sent: number;
  failed: number;
  remaining?: number;
  results: { idnum: string; ok: boolean; error?: string }[];
};

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<{ text: string; error: boolean } | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      const data = await api<{ attendees: Row[]; stats: Stats }>(
        `/api/attendees?q=${encodeURIComponent(q)}`,
      );
      setRows(data.attendees);
      setStats(data.stats);
      setUnlocked(true);
    } catch (err) {
      if (err instanceof AuthError) setUnlocked(false);
      else setLog({ text: err instanceof Error ? err.message : "Load failed.", error: true });
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(search), search ? 250 : 0);
    return () => clearTimeout(id);
  }, [search, load]);

  async function sendOne(row: Row) {
    setSending(true);
    setLog({ text: `Sending to ${row.email}…`, error: false });
    try {
      await api<SendResult>("/api/send-ticket", {
        method: "POST",
        body: JSON.stringify({ idnum: row.idnum, resend: Boolean(row.qr_sent_at) }),
      });
      setLog({ text: `Ticket sent to ${row.email}.`, error: false });
      await load(search);
    } catch (err) {
      setLog({ text: err instanceof Error ? err.message : "Send failed.", error: true });
    } finally {
      setSending(false);
    }
  }

  /**
   * The fallback for when email fails: mint a signed link to that attendee's
   * public ticket page and let staff copy or open it directly. Cached per row
   * so re-opening the panel doesn't re-mint (harmless, but pointless).
   */
  async function getManualLink(row: Row) {
    if (links[row.idnum]) return;
    setLinkBusy(row.idnum);
    try {
      const res = await api<{ path: string }>("/api/ticket-link", {
        method: "POST",
        body: JSON.stringify({ idnum: row.idnum }),
      });
      setLinks((prev) => ({ ...prev, [row.idnum]: `${window.location.origin}${res.path}` }));
    } catch (err) {
      setLog({ text: err instanceof Error ? err.message : "Could not create link.", error: true });
    } finally {
      setLinkBusy(null);
    }
  }

  async function copyLink(idnum: string) {
    const url = links[idnum];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(idnum);
      setTimeout(() => setCopied((c) => (c === idnum ? null : c)), 1800);
    } catch {
      setLog({ text: "Could not copy — select and copy the link manually.", error: true });
    }
  }

  /**
   * Loops bounded batches instead of one big request — Vercel kills functions
   * that run too long, so the server caps each call and we drive the rest.
   */
  async function sendAllPending() {
    setSending(true);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      for (;;) {
        const res = await api<SendResult>("/api/send-ticket", {
          method: "POST",
          body: JSON.stringify({ batch: true, limit: 10 }),
        });
        sent += res.sent;
        failed += res.failed;
        res.results.filter((r) => !r.ok).forEach((r) => errors.push(`${r.idnum}: ${r.error}`));

        setLog({
          text: `Sent ${sent}, ${res.remaining ?? 0} still queued…`,
          error: false,
        });

        if (!res.remaining || res.sent + res.failed === 0) break;
      }

      setLog({
        text:
          `Finished. ${sent} sent, ${failed} failed.` +
          (errors.length ? `\n${errors.join("\n")}` : ""),
        error: failed > 0,
      });
    } catch (err) {
      setLog({ text: err instanceof Error ? err.message : "Batch failed.", error: true });
    } finally {
      setSending(false);
      await load(search);
    }
  }

  if (unlocked === false) return <PasswordGate onUnlock={() => void load(search)} />;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <span className="eyebrow">Sustainability Sphere</span>
          <h1 className={`display ${styles.title}`}>Event desk</h1>
        </div>
        <a className={styles.back} href="/">
          Back to scanner
        </a>
      </header>

      <section className={styles.stats}>
        <div className={styles.stat}>
          <span className="eyebrow">Attendees</span>
          <span className={`mono ${styles.statValue}`}>{stats?.total ?? "—"}</span>
        </div>
        <div className={styles.stat}>
          <span className="eyebrow">Checked in</span>
          <span className={`mono ${styles.statValue} ${styles.statTeal}`}>
            {stats?.registered ?? "—"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className="eyebrow">Food collected</span>
          <span className={`mono ${styles.statValue} ${styles.statMint}`}>
            {stats?.fed ?? "—"}
          </span>
        </div>
        <div className={styles.stat}>
          <span className="eyebrow">Tickets unsent</span>
          <span className={`mono ${styles.statValue}`}>{stats?.unsent ?? "—"}</span>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Ticket emails</h2>
          <span className="eyebrow">{stats?.unsent ?? 0} queued</span>
        </div>
        <p className={styles.panelText}>
          Each attendee gets one email with their QR code embedded in the body.
          Sending runs in batches of ten with a pause between each, to stay inside
          the free tier&rsquo;s rate limit. Leave this tab open until it finishes.
        </p>
        <div className={styles.row}>
          <button
            className={styles.primary}
            onClick={sendAllPending}
            disabled={sending || !stats?.unsent}
          >
            {sending ? "Sending…" : `Send ${stats?.unsent ?? 0} pending tickets`}
          </button>
          <button
            className={styles.ghost}
            onClick={() => void load(search)}
            disabled={sending}
          >
            Refresh
          </button>
        </div>
        {log ? (
          <p className={`${styles.log} ${log.error ? styles.logError : ""}`}>{log.text}</p>
        ) : null}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input
          className={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or ID"
          aria-label="Search attendees"
        />

        <div className={styles.list}>
          {rows.length === 0 ? (
            <p className={styles.empty}>
              {search ? "No attendee matches that search." : "No attendees yet."}
            </p>
          ) : (
            rows.map((row) => (
              <div key={row.idnum} className={styles.itemWrap}>
                <div className={styles.item}>
                  <div className={styles.who}>
                    <span className={styles.whoName}>{row.name}</span>
                    <span className={styles.whoMeta}>
                      <span className="mono">{row.idnum}</span> · {row.email}
                    </span>
                  </div>

                  <div className={styles.chips}>
                    <span
                      className={`${styles.chip} ${row.registered_at ? styles.chipOn : ""}`}
                    >
                      {row.registered_at ? "Checked in" : "Not in"}
                    </span>
                    <span
                      className={`${styles.chip} ${row.food_collected_at ? styles.chipFood : ""}`}
                    >
                      {row.food_collected_at ? "Fed" : "No food"}
                    </span>
                    <span className={styles.chip}>
                      {row.qr_sent_at ? "Ticket sent" : "Unsent"}
                    </span>
                  </div>

                  <div className={styles.rowActions}>
                    <button
                      className={styles.ghostSmall}
                      onClick={() => void getManualLink(row)}
                      disabled={linkBusy === row.idnum}
                    >
                      {linkBusy === row.idnum ? "…" : "Manual ticket"}
                    </button>
                    <button
                      className={styles.send}
                      onClick={() => void sendOne(row)}
                      disabled={sending}
                    >
                      {row.qr_sent_at ? "Resend" : "Send ticket"}
                    </button>
                  </div>
                </div>

                {links[row.idnum] ? (
                  <div className={styles.linkRow}>
                    <input
                      className={styles.linkInput}
                      value={links[row.idnum]}
                      readOnly
                      onFocus={(e) => e.currentTarget.select()}
                      aria-label={`Ticket link for ${row.name}`}
                    />
                    <button className={styles.ghostSmall} onClick={() => void copyLink(row.idnum)}>
                      {copied === row.idnum ? "Copied" : "Copy"}
                    </button>
                    <a
                      className={styles.ghostSmall}
                      href={links[row.idnum]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
