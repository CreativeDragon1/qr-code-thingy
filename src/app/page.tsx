"use client";

import { useCallback, useEffect, useState } from "react";
import PasswordGate from "@/components/PasswordGate";
import Scanner from "@/components/Scanner";
import { api } from "@/lib/client";

export default function ScannerPage() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  // Ask the server rather than checking for a stored value: that way a dev
  // server running without APP_PASSWORD skips the gate entirely, and a stale
  // password from a previous event is rejected up front instead of at the
  // first scan.
  useEffect(() => {
    api("/api/session")
      .then(() => setUnlocked(true))
      .catch(() => setUnlocked(false));
  }, []);

  const lock = useCallback(() => setUnlocked(false), []);

  if (unlocked === null) return null; // avoids a flash of the gate on reload
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <Scanner onAuthError={lock} />;
}
