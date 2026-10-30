export type CronPreset = {
  label: string;
  value: string;
};

export const CRON_PRESETS: readonly CronPreset[] = [
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Weekdays at 9:00", value: "0 9 * * 1-5" },
  { label: "First of the month", value: "0 0 1 * *" },
];
