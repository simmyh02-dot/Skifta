import { tagColor } from "@/lib/tag-color";

// A small colour dot + tag name, the way shifts are labelled in the references
// (e.g. "● Floor", "● Kitchen"). Colour is derived stably from the tag name.

export function TagDot({ name, muted = false }: { name: string; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: tagColor(name) }}
      />
      <span className={muted ? "text-ink-faint" : "text-ink-muted"}>{name}</span>
    </span>
  );
}
