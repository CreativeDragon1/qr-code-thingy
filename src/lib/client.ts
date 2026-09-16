"use client";

import { APP_PASSWORD_HEADER } from "./constants";
import type { ScanMode } from "./qr";

const PASSWORD_KEY = "sus.appPassword";
const MODE_KEY = "sus.scanMode";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private browsing / storage disabled
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* fall back to in-memory for this session */
  }
}

export function getPassword(): string {
  return read(PASSWORD_KEY) ?? "";
}

export function setPassword(value: string): void {
  write(PASSWORD_KEY, value);
}

export function clearPassword(): void {
  try {
    window.localStorage.removeItem(PASSWORD_KEY);
  } catch {
    /* ignore */
  }
}

/** Mode is per-device: two volunteers can run registration and food at once. */
export function getMode(): ScanMode {
  return read(MODE_KEY) === "food" ? "food" : "registration";
}

export function setMode(mode: ScanMode): void {
  write(MODE_KEY, mode);
}

export class AuthError extends Error {}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      [APP_PASSWORD_HEADER]: getPassword(),
      ...(init.headers ?? {}),
    },
  });

  const payload = await res.json().catch(() => ({}));

  if (res.status === 401) {
    clearPassword();
    throw new AuthError(payload.error ?? "Incorrect password.");
  }
  if (!res.ok) {
    throw new Error(payload.error ?? `Request failed (${res.status}).`);
  }
  return payload as T;
}
