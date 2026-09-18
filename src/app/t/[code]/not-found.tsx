export default function AccessCodeNotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 28,
        textAlign: "center",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
        <h1 className="display" style={{ fontSize: "1.8rem", fontWeight: 800 }}>
          Code not recognized
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Double-check the code was typed correctly, or ask the event desk to send it
          again.
        </p>
      </div>
    </div>
  );
}
