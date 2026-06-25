import { clsx } from "@/lib/clsx";

/**
 * Skifta wordmark: a solid rounded diamond + the name in the display face.
 * `tone="light"` is for placing the logo on dark surfaces.
 */
export function Logo({
  tone = "ink",
  className,
}: {
  tone?: "ink" | "light";
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 font-display font-bold tracking-tight",
        tone === "light" ? "text-dark-ink" : "text-ink",
        className,
      )}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="10"
          y="0.5"
          width="13.4"
          height="13.4"
          rx="3"
          transform="rotate(45 10 0.5)"
          fill="currentColor"
        />
      </svg>
      <span className="text-[1.15rem] leading-none">Skifta</span>
    </span>
  );
}
