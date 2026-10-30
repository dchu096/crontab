export function normalizeCron(value: string): string {
  const text = value.trim().toUpperCase().replace(/^\/(\d+)/, "*/$1");
  if (!text) return "";
  if (!/\s/.test(text) && /^\*{2,5}$/.test(text)) return text.split("").join(" ");
  return text.replace(/\s+/g, " ");
}
