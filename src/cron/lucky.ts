import { CRON_FIELDS, type CronField } from "./fields.ts";
import { evaluateCron } from "./evaluate.ts";
import { normalizeCron } from "./normalize.ts";

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function randomField(field: CronField, random: () => number): string {
  const kind = Math.floor(random() * 5);
  if (kind === 0) return "*";
  if (kind === 1) return String(randomInt(random, field.min, field.max));
  if (kind === 2) {
    const span = Math.max(1, field.max - field.min);
    return `*/${randomInt(random, 1, span)}`;
  }
  if (kind === 3) {
    const start = randomInt(random, field.min, field.max - 1);
    const end = randomInt(random, start + 1, field.max);
    return `${start}-${end}`;
  }

  const count = randomInt(random, 2, 3);
  const values = new Set<number>();
  while (values.size < count) values.add(randomInt(random, field.min, field.max));
  return [...values].sort((left, right) => left - right).join(",");
}

export function randomCron(currentNormalized: string, random: () => number = Math.random): string {
  const current = normalizeCron(currentNormalized);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const expression = CRON_FIELDS.map((field) => randomField(field, random)).join(" ");
    const state = evaluateCron(expression);
    if (state.status === "valid" && state.normalized !== current) return state.normalized;
  }
  return current === "0 * * * *" ? "*/5 * * * *" : "0 * * * *";
}
