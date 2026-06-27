// Avatar — initials in a ringed circle, as in the design references (MK, EL, YO).
// Owner/self can be filled teal; everyone else is an outlined cream chip.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizes = {
  sm: "h-8 w-8 text-[0.65rem]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function Avatar({
  name,
  size = "md",
  filled = false,
}: {
  name: string;
  size?: keyof typeof sizes;
  filled?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${
        filled
          ? "bg-primary text-primary-ink"
          : "bg-surface text-primary ring-1 ring-primary/30"
      }`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
