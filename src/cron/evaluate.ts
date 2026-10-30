import { CronExpressionParser } from "cron-parser";
import cronstrue from "cronstrue";
import { CRON_FIELDS, type CronField } from "./fields.ts";
import { normalizeCron } from "./normalize.ts";

export type CronStatus = "empty" | "valid" | "invalid";

export type CronState = {
  status: CronStatus;
  normalized: string;
  parts: string[];
  sentence: string;
  nextExecution: string | null;
  invalidFieldIndexes: number[];
  highlightEntireExpression: boolean;
};

const FIVE_FIELDS =
  "A cron expression needs five fields separated by spaces: minute, hour, day of the month, month, and day of the week.";

type SegmentIssue = "ok" | "step" | "reversed" | "invalid";

function parseValue(token: string, field: CronField): number | null {
  if (/^\d+$/.test(token)) {
    const value = Number(token);
    return value >= field.min && value <= field.max ? value : null;
  }
  return field.aliases?.[token] ?? null;
}

function classifyRange(range: string, field: CronField): SegmentIssue {
  const [startToken, endToken, extra] = range.split("-");
  if (extra !== undefined || !startToken || !endToken) return "invalid";
  const start = parseValue(startToken, field);
  const end = parseValue(endToken, field);
  if (start === null || end === null) return "invalid";
  return start > end ? "reversed" : "ok";
}

function classifySegment(segment: string, field: CronField): SegmentIssue {
  if (!segment) return "invalid";

  if (segment.includes(",")) {
    for (const piece of segment.split(",")) {
      const issue = classifySegment(piece.trim(), field);
      if (issue !== "ok") return issue;
    }
    return "ok";
  }

  if (segment.includes("/")) {
    const [base, step, extra] = segment.split("/");
    if (extra !== undefined || !base || !step) return "invalid";
    if (!/^\d+$/.test(step) || Number(step) <= 0) return "step";
    if (base === "*") return "ok";
    if (base.includes("-")) return classifyRange(base, field);
    return parseValue(base, field) === null ? "invalid" : "ok";
  }

  if (segment === "*") return "ok";
  if (segment.includes("-")) return classifyRange(segment, field);
  return parseValue(segment, field) === null ? "invalid" : "ok";
}

function fieldSentence(field: CronField, issue: SegmentIssue): string {
  if (issue === "step") return `${field.label} step must be a number greater than 0.`;
  if (issue === "reversed") return `${field.label} range must go from low to high.`;
  return field.rangeReason;
}

export function formatNextExecution(date: Date): string {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  const day = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${weekday} ${day} ${month}, ${time}`;
}

export function evaluateCron(
  value: string,
  now: Date = new Date(),
  describe: (expression: string) => string = (expression) =>
    cronstrue.toString(expression, { use24HourTimeFormat: true }),
): CronState {
  const normalized = normalizeCron(value);
  if (!normalized) {
    return {
      status: "empty",
      normalized: "",
      parts: [],
      sentence: "Enter a cron expression.",
      nextExecution: null,
      invalidFieldIndexes: [],
      highlightEntireExpression: false,
    };
  }

  const parts = normalized.split(" ");
  if (parts.length !== 5) {
    return {
      status: "invalid",
      normalized,
      parts,
      sentence: FIVE_FIELDS,
      nextExecution: null,
      invalidFieldIndexes: [],
      highlightEntireExpression: true,
    };
  }

  const issues = parts.map((part, index) => classifySegment(part, CRON_FIELDS[index]));
  const invalidFieldIndexes = issues.flatMap((issue, index) => (issue === "ok" ? [] : [index]));
  if (invalidFieldIndexes.length > 0) {
    const first = invalidFieldIndexes[0];
    return {
      status: "invalid",
      normalized,
      parts,
      sentence: fieldSentence(CRON_FIELDS[first], issues[first]),
      nextExecution: null,
      invalidFieldIndexes,
      highlightEntireExpression: false,
    };
  }

  try {
    const interval = CronExpressionParser.parse(normalized, { currentDate: now });
    const next = interval.next().toDate();
    let sentence: string;
    try {
      sentence = describe(normalized);
    } catch {
      sentence = "Unable to read this cron expression.";
    }
    return {
      status: "valid",
      normalized,
      parts,
      sentence,
      nextExecution: formatNextExecution(next),
      invalidFieldIndexes: [],
      highlightEntireExpression: false,
    };
  } catch (error) {
    const message = error instanceof Error && error.message.trim()
      ? error.message
      : "Unable to parse cron expression.";
    return {
      status: "invalid",
      normalized,
      parts,
      sentence: message,
      nextExecution: null,
      invalidFieldIndexes: [],
      highlightEntireExpression: true,
    };
  }
}
