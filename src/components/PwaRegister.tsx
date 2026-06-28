"use client";

import { useEffect } from "react";

// Registers the offline-shell service worker app-wide (§14.3 step 1) — the
// same worker already built for the clock-in offline queue (§6.2) doubles as
// the PWA's install/offline shell, since it already runtime-caches the page
// shell and static assets at the root scope.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/clock-sw.js").catch(() => {});
    }
  }, []);

  return null;
}
