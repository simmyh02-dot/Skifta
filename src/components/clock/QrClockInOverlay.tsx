"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";

// Clock-IN from a worker's own phone (§5/§6.2) must go through the venue's
// QR — never straight to `/api/clock/self` — so the place is proven the same
// way the shared kiosk proves it. `BarcodeDetector` (Android/Chrome) decodes
// the QR in-page and we navigate straight to the kiosk URL it encodes
// (`/clock/<token>`), reusing 100% of the already-built, already-verified
// kiosk flow (token check, Face ID/PIN, offline queue) rather than
// duplicating it. Safari/iPhone has no `BarcodeDetector` (no new dependency
// per §17 rules out a JS decoder) — there we just point the worker at their
// phone's own camera app, which already opens the same QR's URL natively.

type BarcodeDetectorCtor = new (options?: { formats: string[] }) => {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
};

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

export function QrClockInOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported] = useState(() => getBarcodeDetector() !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Detector = getBarcodeDetector();
    if (!Detector) return;

    let stream: MediaStream | null = null;
    let stopped = false;
    let raf = 0;
    const detector = new Detector({ formats: ["qr_code"] });

    async function scan() {
      if (stopped || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        const value = codes[0]?.rawValue;
        if (value && /\/clock\//.test(value)) {
          stopped = true;
          window.location.href = value;
          return;
        }
      } catch {
        // A single failed decode attempt on one frame isn't an error — keep scanning.
      }
      raf = requestAnimationFrame(scan);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (!videoRef.current) return;
        videoRef.current.srcObject = s;
        await videoRef.current.play();
        scan();
      })
      .catch(() => setError(t("clock.scan.cameraError")));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [t]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6">
      {supported ? (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-square w-full max-w-xs rounded-2xl bg-black object-cover"
          />
          <p className="mt-4 max-w-xs text-center text-sm text-white/80">
            {t("clock.scan.instructions")}
          </p>
          {error && <p className="mt-2 text-sm text-accent">{error}</p>}
        </>
      ) : (
        <div className="max-w-xs text-center text-white">
          <p className="text-lg font-semibold">{t("clock.scan.unsupportedTitle")}</p>
          <p className="mt-2 text-sm text-white/80">{t("clock.scan.unsupportedBody")}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-6 h-11 rounded-full border border-white/30 px-5 text-sm text-white hover:bg-white/10"
      >
        {t("clock.scan.cancel")}
      </button>
    </div>
  );
}
