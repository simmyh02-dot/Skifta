// Tiny classNames joiner — avoids a dependency for simple conditional classes.
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[];

export function clsx(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = clsx(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(" ");
}
