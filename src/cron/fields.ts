export type CronField = {
  label: string;
  min: number;
  max: number;
  aliases?: Record<string, number>;
  rangeReason: string;
};

export const CRON_FIELDS: readonly CronField[] = [
  {
    label: "Minute",
    min: 0,
    max: 59,
    rangeReason: "Minute must be from 0 to 59.",
  },
  {
    label: "Hour",
    min: 0,
    max: 23,
    rangeReason: "Hour must be from 0 to 23.",
  },
  {
    label: "Day of the month",
    min: 1,
    max: 31,
    rangeReason: "Day of the month must be from 1 to 31.",
  },
  {
    label: "Month",
    min: 1,
    max: 12,
    aliases: {
      JAN: 1,
      FEB: 2,
      MAR: 3,
      APR: 4,
      MAY: 5,
      JUN: 6,
      JUL: 7,
      AUG: 8,
      SEP: 9,
      OCT: 10,
      NOV: 11,
      DEC: 12,
    },
    rangeReason: "Month must be from 1 to 12, or JAN–DEC.",
  },
  {
    label: "Day of the week",
    min: 0,
    max: 7,
    aliases: {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    },
    rangeReason: "Day of the week must be from 0 to 7, or SUN–SAT.",
  },
];
