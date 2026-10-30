import { CRON_FIELDS, type CronField } from "./fields.ts";

export type BuilderKey = "minute" | "hour" | "dom" | "month" | "dow";

export type FieldChoice =
  | { kind: "any" }
  | { kind: "step"; step: number }
  | { kind: "value"; value: number }
  | { kind: "list"; values: number[] }
  | { kind: "custom"; token: string };

export type BuilderState = Record<BuilderKey, FieldChoice>;

export const BUILDER_KEYS: readonly BuilderKey[] = ["minute", "hour", "dom", "month", "dow"];

export function createEmptyBuilder(): BuilderState {
  return {
    minute: { kind: "any" },
    hour: { kind: "any" },
    dom: { kind: "any" },
    month: { kind: "any" },
    dow: { kind: "any" },
  };
}

function fieldForKey(key: BuilderKey): CronField {
  return CRON_FIELDS[BUILDER_KEYS.indexOf(key)];
}

function parseSingle(token: string, field: CronField): number | null {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return value >= field.min && value <= field.max ? value : null;
  }
  return field.aliases?.[token] ?? null;
}

function normalizeDay(value: number): number {
  return value === 7 ? 0 : value;
}

function parseDayList(token: string, field: CronField): number[] | null {
  const days = new Set<number>();

  for (const piece of token.split(",")) {
    if (!piece) return null;
    if (piece.includes("-")) {
      const [startToken, endToken, extra] = piece.split("-");
      if (extra !== undefined) return null;
      const start = parseSingle(startToken, field);
      const end = parseSingle(endToken, field);
      if (start === null || end === null || start > end) return null;
      for (let day = start; day <= end; day += 1) days.add(normalizeDay(day));
    } else {
      const day = parseSingle(piece, field);
      if (day === null) return null;
      days.add(normalizeDay(day));
    }
  }

  if (days.size === 0) return null;
  return [...days].sort((left, right) => left - right);
}

function parseChoice(token: string, key: BuilderKey): FieldChoice {
  const upper = token.toUpperCase();
  const field = fieldForKey(key);

  if (upper === "*") return { kind: "any" };

  const step = /^\*\/(\d+)$/.exec(upper);
  if (step) {
    const value = Number(step[1]);
    if (key !== "month" && key !== "dow" && Number.isInteger(value) && value > 0 && value <= field.max) {
      return { kind: "step", step: value };
    }
    return { kind: "custom", token: upper };
  }

  if (key === "dow") {
    const days = parseDayList(upper, field);
    return days ? { kind: "list", values: days } : { kind: "custom", token: upper };
  }

  const single = parseSingle(upper, field);
  return single === null ? { kind: "custom", token: upper } : { kind: "value", value: single };
}

export function parseBuilder(normalized: string): BuilderState {
  const text = normalized.trim();
  const tokens = text ? text.split(/\s+/) : [];
  const state = createEmptyBuilder();

  BUILDER_KEYS.forEach((key, index) => {
    const token = tokens[index];
    state[key] = token ? parseChoice(token, key) : { kind: "any" };
  });

  return state;
}

function compressNumbers(values: number[]): string {
  const sorted = [...new Set(values)].sort((left, right) => left - right);
  if (sorted.length === 0) return "*";

  const parts: string[] = [];
  let start = sorted[0];
  let previous = start;

  for (let index = 1; index <= sorted.length; index += 1) {
    const value = sorted[index];
    if (index < sorted.length && value === previous + 1) {
      previous = value;
      continue;
    }

    if (previous > start + 1) {
      parts.push(`${start}-${previous}`);
    } else {
      for (let current = start; current <= previous; current += 1) {
        parts.push(String(current));
      }
    }

    if (index < sorted.length) {
      start = value;
      previous = value;
    }
  }

  return parts.join(",");
}

export function serializeChoice(key: BuilderKey, choice: FieldChoice): string {
  switch (choice.kind) {
    case "any":
      return "*";
    case "step":
      return choice.step <= 1 ? "*" : `*/${choice.step}`;
    case "value":
      return String(key === "dow" ? normalizeDay(choice.value) : choice.value);
    case "list":
      return compressNumbers(choice.values);
    case "custom":
      return choice.token;
  }
}

export function composeCron(state: BuilderState): string {
  return BUILDER_KEYS.map((key) => serializeChoice(key, state[key])).join(" ");
}

export function hasCustomChoice(state: BuilderState): boolean {
  return BUILDER_KEYS.some((key) => state[key].kind === "custom");
}

export function isWeekdayList(choice: FieldChoice): boolean {
  return (
    choice.kind === "list" &&
    choice.values.length === 5 &&
    choice.values.every((day, index) => day === index + 1)
  );
}

export function isWeekendList(choice: FieldChoice): boolean {
  return (
    choice.kind === "list" &&
    choice.values.length === 2 &&
    choice.values[0] === 0 &&
    choice.values[1] === 6
  );
}
