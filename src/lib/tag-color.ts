// Tag colours for the schedule/clock UI (§7). Tags are free-form per restaurant,
// so we map the common Swedish/English names to the palette seen in the design
// references (Kitchen = terracotta, Floor/serving = teal, Bar = dark) and hash
// any other name to a stable palette colour so it stays consistent across views.

const PALETTE = ["#2c6a5e", "#b4663b", "#3b5b74", "#7a6a3b", "#6b3b5b", "#4b6b3b"];

const KNOWN: Record<string, string> = {
  kök: "#b4663b",
  kitchen: "#b4663b",
  servering: "#2c6a5e",
  serving: "#2c6a5e",
  floor: "#2c6a5e",
  golv: "#2c6a5e",
  bar: "#2f2f2b",
  disk: "#3b5b74",
  dish: "#3b5b74",
};

export function tagColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (KNOWN[key]) return KNOWN[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
