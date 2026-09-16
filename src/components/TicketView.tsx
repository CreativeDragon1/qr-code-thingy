"use client";

import { useRef, useState } from "react";
import styles from "./TicketView.module.css";

export type TicketViewProps = {
  name: string;
  email: string;
  idnum: string;
  qrDataUrl: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
};

export default function TicketView(props: TicketViewProps) {
  const { name, email, idnum, qrDataUrl, eventName, eventDate, eventLocation } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (!cardRef.current) return;
    setDownloading(true);
    setError(null);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${idnum}.png`;
      a.click();
    } catch {
      setError("Could not generate the image on this device. Try a screenshot instead.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card} ref={cardRef}>
        <div className={styles.header}>
          <span className={styles.eyebrowLight}>Admit one</span>
          <span className={styles.eventName}>{eventName}</span>
        </div>

        <div className={styles.body}>
          <span className={styles.label}>Ticket holder</span>
          <span className={styles.name}>{name}</span>
          <span className={styles.email}>{email}</span>
        </div>

        {(eventDate || eventLocation) && (
          <div className={styles.metaRow}>
            {eventDate ? (
              <div className={styles.metaCol}>
                <span className={styles.label}>When</span>
                <span className={styles.metaValue}>{eventDate}</span>
              </div>
            ) : null}
            {eventLocation ? (
              <div className={styles.metaCol}>
                <span className={styles.label}>Where</span>
                <span className={styles.metaValue}>{eventLocation}</span>
              </div>
            ) : null}
          </div>
        )}

        <div className={styles.qrWrap}>
          <div className={styles.qrBox}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not a remote image */}
            <img className={styles.qrImg} src={qrDataUrl} alt={`Entry QR code for ${name}`} />
          </div>
        </div>

        <div className={styles.idBlock}>
          <span className={styles.label}>Attendee ID</span>
          <div className={styles.idValue}>{idnum}</div>
        </div>

        <div className={styles.notice}>
          Show this QR code to a volunteer at the entrance. The same code is
          scanned once to check you in and once more to collect your food.
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.download} onClick={download} disabled={downloading}>
          {downloading ? "Preparing image…" : "Download ticket as image"}
        </button>
        {error ? <p className={styles.hint}>{error}</p> : null}
        <p className={styles.hint}>
          Or just take a screenshot — the QR code works either way.
        </p>
      </div>
    </div>
  );
}
