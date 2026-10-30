import "./style.css";
import { composeCron, createEmptyBuilder, hasCustomChoice, isWeekdayList, isWeekendList, parseBuilder, serializeChoice, type BuilderKey, type BuilderState } from "./cron/builder.ts";
import { evaluateCron, type CronState } from "./cron/evaluate.ts";
import { CRON_FIELDS } from "./cron/fields.ts";
import { randomCron } from "./cron/lucky.ts";
import { normalizeCron } from "./cron/normalize.ts";
import { CRON_PRESETS } from "./cron/presets.ts";

type MountOptions = {
  now?: () => Date;
  random?: () => number;
};

type Theme = "light" | "dark";
type NumberRowKey = "minute" | "hour" | "dom";

const THEME_STORAGE_KEY = "crontab.tk:theme";
const TOKEN_LABELS = ["MIN", "HR", "DOM", "MON", "DOW"] as const;
const WEEKDAYS = [
  { value: 0, label: "SUN", name: "Sunday" },
  { value: 1, label: "MON", name: "Monday" },
  { value: 2, label: "TUE", name: "Tuesday" },
  { value: 3, label: "WED", name: "Wednesday" },
  { value: 4, label: "THU", name: "Thursday" },
  { value: 5, label: "FRI", name: "Friday" },
  { value: 6, label: "SAT", name: "Saturday" },
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const SUN_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`;
const GITHUB_ICON = `<svg viewBox="0 0 19 19" width="15" height="15" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M9.356 1.85C5.05 1.85 1.57 5.356 1.57 9.694a7.84 7.84 0 0 0 5.324 7.44c.387.079.528-.168.528-.376 0-.182-.013-.805-.013-1.454-2.165.467-2.616-.935-2.616-.935-.349-.91-.864-1.143-.864-1.143-.71-.48.051-.48.051-.48.787.051 1.2.805 1.2.805.695 1.194 1.817.857 2.268.649.064-.507.27-.857.49-1.052-1.728-.182-3.545-.857-3.545-3.87 0-.857.31-1.558.8-2.104-.078-.195-.349-1 .077-2.078 0 0 .657-.208 2.14.805a7.5 7.5 0 0 1 1.946-.26c.657 0 1.328.092 1.946.26 1.483-1.013 2.14-.805 2.14-.805.426 1.078.155 1.883.078 2.078.502.546.799 1.247.799 2.104 0 3.013-1.818 3.675-3.558 3.87.284.247.528.714.528 1.454 0 1.052-.012 1.896-.012 2.156 0 .208.142.455.528.377a7.84 7.84 0 0 0 5.324-7.441c.013-4.338-3.48-7.844-7.773-7.844" clip-rule="evenodd"/></svg>`;

function readStoredTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function preferredTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  const prefersLight =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

function applyTheme(theme: Theme, persist: boolean): void {
  document.documentElement.dataset.theme = theme;
  if (!persist) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable; the theme still applies for this visit.
  }
}

let activeTheme = preferredTheme();
applyTheme(activeTheme, false);

function must<T extends Element>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTokens(container: HTMLElement, state: CronState): void {
  container.replaceChildren();
  if (state.status === "empty" || state.parts.length !== 5) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  state.parts.forEach((part, index) => {
    const bad =
      state.highlightEntireExpression || state.invalidFieldIndexes.includes(index);
    const token = element("span", bad ? "token token--bad" : "token");
    token.append(
      element("span", "token__label", TOKEN_LABELS[index]),
      element("span", "token__value", part),
    );
    container.append(token);
  });
}

type BuilderRow = {
  select: HTMLSelectElement;
  extra: HTMLElement;
  input: HTMLInputElement | null;
  suffix: HTMLElement | null;
  month: HTMLSelectElement | null;
  days: HTMLButtonElement[] | null;
};

type NumberRowConfig = {
  key: NumberRowKey;
  abbr: string;
  name: string;
  field: (typeof CRON_FIELDS)[number];
  everyLabel: string;
  valueLabel: string;
  stepSuffix: string;
  defaultStep: number;
  defaultValue: number;
};

const NUMBER_ROWS: readonly NumberRowConfig[] = [
  {
    key: "minute",
    abbr: "MIN",
    name: "minute",
    field: CRON_FIELDS[0],
    everyLabel: "Every minute",
    valueLabel: "At minute",
    stepSuffix: "minutes",
    defaultStep: 5,
    defaultValue: 0,
  },
  {
    key: "hour",
    abbr: "HR",
    name: "hour",
    field: CRON_FIELDS[1],
    everyLabel: "Every hour",
    valueLabel: "At hour",
    stepSuffix: "hours",
    defaultStep: 2,
    defaultValue: 9,
  },
  {
    key: "dom",
    abbr: "DOM",
    name: "day of month",
    field: CRON_FIELDS[2],
    everyLabel: "Every day",
    valueLabel: "On day",
    stepSuffix: "days",
    defaultStep: 2,
    defaultValue: 1,
  },
];

function createSelect(id: string, options: readonly { value: string; label: string }[]): HTMLSelectElement {
  const select = element("select", "builder__select");
  select.id = id;
  for (const option of options) {
    const node = element("option", undefined, option.label);
    node.value = option.value;
    select.append(node);
  }
  return select;
}

function createRow(abbr: string, name: string, select: HTMLSelectElement, extra: HTMLElement): HTMLElement {
  const row = element("div", "builder__row");
  const label = element("label", "builder__label");
  label.htmlFor = select.id;
  label.append(element("span", "builder__abbr", abbr), element("span", "builder__name", name));
  row.append(label, select, extra);
  return row;
}

function setCustomOption(select: HTMLSelectElement, token: string | null): void {
  const existing = select.querySelector<HTMLOptionElement>('option[value="custom"]');
  if (!token) {
    existing?.remove();
    return;
  }
  const option = existing ?? element("option");
  option.value = "custom";
  option.textContent = `Custom (${token})`;
  if (!existing) select.append(option);
}

function clampInput(input: HTMLInputElement, min: number, max: number, fallback: number): number {
  const raw = Number(input.value);
  if (input.value.trim() === "" || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

function configureNumberInput(
  config: NumberRowConfig,
  mode: "step" | "value",
  input: HTMLInputElement,
  suffix: HTMLElement,
): void {
  const isStep = mode === "step";
  input.min = String(isStep ? 1 : config.field.min);
  input.max = String(config.field.max);
  suffix.hidden = !isStep;
  suffix.textContent = config.stepSuffix;
}

export function mountCronApp(root: HTMLElement, options: MountOptions = {}): void {
  const now = options.now ?? ((): Date => new Date());
  const random = options.random ?? Math.random;
  document.title = "Cron generator · crontab.tk";

  activeTheme =
    document.documentElement.dataset.theme === "light" ||
    document.documentElement.dataset.theme === "dark"
      ? (document.documentElement.dataset.theme as Theme)
      : preferredTheme();
  applyTheme(activeTheme, false);

  root.innerHTML = `
    <div class="page">
      <header class="nav">
        <a class="nav__brand" href="/">crontab.tk</a>
        <h1 class="nav__title">Cron generator</h1>
        <button class="theme-toggle" type="button"></button>
      </header>
      <main class="main">
        <div class="workspace">
          <div class="modes" role="tablist" aria-label="Cron input mode">
            <button class="mode is-active" type="button" role="tab" aria-selected="true" aria-controls="panel-type" data-mode="type">Type a cron</button>
            <button class="mode" type="button" role="tab" aria-selected="false" aria-controls="panel-build" data-mode="build">Build from choices</button>
          </div>
          <section class="panel panel--type" id="panel-type" role="tabpanel">
            <div class="expression">
              <input
                class="expression__input"
                aria-label="Cron expression"
                aria-describedby="cron-sentence"
                spellcheck="false"
                autocomplete="off"
                autocapitalize="off"
                enterkeyhint="done"
              />
            </div>
            <div class="tokens" aria-hidden="true" hidden></div>
          </section>
          <section class="panel panel--build" id="panel-build" role="tabpanel" hidden>
            <div class="build-preview">
              <span class="build-preview__label">Cron</span>
              <code id="build-expr">* * * * *</code>
            </div>
            <div class="builder"></div>
            <p class="builder__note" hidden></p>
          </section>
          <p class="reading" id="cron-sentence" aria-live="polite"></p>
          <p class="next" id="cron-next" hidden></p>
          <div class="actions actions--type">
            <div class="presets"></div>
          </div>
          <div class="actions actions--build" hidden>
            <button class="text-button" type="button" data-action="edit">Edit as text</button>
          </div>
          <details class="cheatsheet">
            <summary>Cheatsheet</summary>
            <div class="cheatsheet__body">
              <div>
                <h2>Fields</h2>
                <table>
                  <thead>
                    <tr><th>Label</th><th>Field</th><th>Values</th></tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">MIN</th><td>minute</td><td>0–59</td></tr>
                    <tr><th scope="row">HR</th><td>hour</td><td>0–23</td></tr>
                    <tr><th scope="row">DOM</th><td>day of month</td><td>1–31</td></tr>
                    <tr><th scope="row">MON</th><td>month</td><td>1–12 or JAN–DEC</td></tr>
                    <tr><th scope="row">DOW</th><td>day of week</td><td>0–7 or SUN–SAT</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h2>Syntax</h2>
                <dl class="syntax">
                  <div><dt><code>*</code></dt><dd>any value</dd></div>
                  <div><dt><code>,</code></dt><dd>list, like <code>0,30</code></dd></div>
                  <div><dt><code>-</code></dt><dd>range, like <code>1-5</code></dd></div>
                  <div><dt><code>/</code></dt><dd>step, like <code>*/15</code></dd></div>
                </dl>
                <p class="examples"><code>*/15 * * * *</code> every 15 minutes<br /><code>0 9 * * 1-5</code> weekdays at 09:00</p>
              </div>
            </div>
          </details>
        </div>
      </main>
      <footer class="footer">
        <span>This service is part of <a href="https://dchu096.me" target="_blank" rel="noreferrer">dchu096</a>.</span>
        <a class="footer__repo" href="https://github.com/dchu096/crontab" target="_blank" rel="noreferrer">${GITHUB_ICON}<span>Visit this repo on GitHub</span></a>
      </footer>
    </div>
  `;

  const field = must<HTMLInputElement>(root, ".expression__input");
  const tokens = must<HTMLElement>(root, ".tokens");
  const sentence = must<HTMLElement>(root, "#cron-sentence");
  const next = must<HTMLElement>(root, "#cron-next");
  const presets = must<HTMLElement>(root, ".presets");
  const themeButton = must<HTMLButtonElement>(root, ".theme-toggle");
  const modeButtons = [...root.querySelectorAll<HTMLButtonElement>(".mode")];
  const typePanel = must<HTMLElement>(root, "#panel-type");
  const buildPanel = must<HTMLElement>(root, "#panel-build");
  const typeActions = must<HTMLElement>(root, ".actions--type");
  const buildActions = must<HTMLElement>(root, ".actions--build");
  const buildExpression = must<HTMLElement>(root, "#build-expr");
  const buildNote = must<HTMLElement>(root, ".builder__note");
  const builder = must<HTMLElement>(root, ".builder");

  const rowUI = {} as Record<BuilderKey, BuilderRow>;
  let builderState: BuilderState = createEmptyBuilder();

  const renderThemeButton = (): void => {
    const goingLight = activeTheme === "dark";
    themeButton.innerHTML = goingLight ? SUN_ICON : MOON_ICON;
    const label = goingLight ? "Switch to light theme" : "Switch to dark theme";
    themeButton.setAttribute("aria-label", label);
    themeButton.title = label;
  };

  renderThemeButton();
  themeButton.addEventListener("click", () => {
    activeTheme = activeTheme === "light" ? "dark" : "light";
    applyTheme(activeTheme, true);
    renderThemeButton();
  });

  for (const config of NUMBER_ROWS) {
    const select = createSelect(`builder-${config.key}-mode`, [
      { value: "any", label: config.everyLabel },
      { value: "step", label: "Every N" },
      { value: "value", label: config.valueLabel },
    ]);
    const extra = element("div", "builder__extra");
    const input = element("input", "builder__number");
    input.type = "number";
    input.id = `builder-${config.key}-number`;
    input.inputMode = "numeric";
    const suffix = element("span", "builder__suffix", config.stepSuffix);
    extra.append(input, suffix);
    builder.append(createRow(config.abbr, config.name, select, extra));
    rowUI[config.key] = { select, extra, input, suffix, month: null, days: null };

    select.addEventListener("change", () => {
      const mode = select.value;
      if (mode === "any") {
        builderState[config.key] = { kind: "any" };
      } else if (mode === "step" || mode === "value") {
        configureNumberInput(config, mode, input, suffix);
        const fallback = mode === "step" ? config.defaultStep : config.defaultValue;
        const value = clampInput(
          input,
          mode === "step" ? 1 : config.field.min,
          config.field.max,
          fallback,
        );
        input.value = String(value);
        builderState[config.key] =
          mode === "step" ? { kind: "step", step: value } : { kind: "value", value };
      } else {
        const current = builderState[config.key];
        if (current.kind !== "custom") {
          builderState[config.key] = { kind: "custom", token: serializeChoice(config.key, current) };
        }
      }
      syncRows();
      commitBuilder();
    });

    input.addEventListener("input", () => {
      const mode = select.value;
      if (mode !== "step" && mode !== "value") return;
      const raw = Number(input.value);
      if (input.value.trim() === "" || !Number.isInteger(raw)) return;
      const min = mode === "step" ? 1 : config.field.min;
      if (raw < min || raw > config.field.max) return;
      builderState[config.key] =
        mode === "step" ? { kind: "step", step: raw } : { kind: "value", value: raw };
      commitBuilder();
    });

    input.addEventListener("change", () => {
      const mode = select.value;
      if (mode !== "step" && mode !== "value") return;
      const min = mode === "step" ? 1 : config.field.min;
      const fallback = mode === "step" ? config.defaultStep : config.defaultValue;
      const value = clampInput(input, min, config.field.max, fallback);
      input.value = String(value);
      builderState[config.key] =
        mode === "step" ? { kind: "step", step: value } : { kind: "value", value };
      commitBuilder();
    });
  }

  {
    const select = createSelect("builder-month-mode", [
      { value: "any", label: "Every month" },
      { value: "value", label: "In month" },
    ]);
    const extra = element("div", "builder__extra");
    const month = createSelect(
      "builder-month-value",
      MONTHS.map((label, index) => ({ value: String(index + 1), label })),
    );
    month.classList.add("builder__month");
    extra.append(month);
    builder.append(createRow("MON", "month", select, extra));
    rowUI.month = { select, extra, input: null, suffix: null, month, days: null };

    select.addEventListener("change", () => {
      if (select.value === "any") {
        builderState.month = { kind: "any" };
      } else if (select.value === "value") {
        builderState.month = { kind: "value", value: Number(month.value) };
      } else {
        const current = builderState.month;
        if (current.kind !== "custom") {
          builderState.month = { kind: "custom", token: serializeChoice("month", current) };
        }
      }
      syncRows();
      commitBuilder();
    });

    month.addEventListener("change", () => {
      builderState.month = { kind: "value", value: Number(month.value) };
      syncRows();
      commitBuilder();
    });
  }

  {
    const select = createSelect("builder-dow-mode", [
      { value: "any", label: "Any day" },
      { value: "weekdays", label: "Weekdays (Mon–Fri)" },
      { value: "weekends", label: "Weekends (Sat–Sun)" },
      { value: "only", label: "Only on…" },
    ]);
    const extra = element("div", "builder__extra builder__days");
    const days: HTMLButtonElement[] = WEEKDAYS.map((day) => {
      const button = element("button", "weekday", day.label);
      button.type = "button";
      button.dataset.day = String(day.value);
      button.title = day.name;
      button.setAttribute("aria-label", day.name);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const current = builderState.dow;
        const values = current.kind === "list" ? [...current.values] : [];
        const index = values.indexOf(day.value);
        if (index >= 0) {
          if (values.length === 1) return;
          values.splice(index, 1);
        } else {
          values.push(day.value);
        }
        values.sort((left, right) => left - right);
        builderState.dow = { kind: "list", values };
        syncRows();
        commitBuilder();
      });
      extra.append(button);
      return button;
    });
    builder.append(createRow("DOW", "day of week", select, extra));
    rowUI.dow = { select, extra, input: null, suffix: null, month: null, days };

    select.addEventListener("change", () => {
      if (select.value === "any") {
        builderState.dow = { kind: "any" };
      } else if (select.value === "weekdays") {
        builderState.dow = { kind: "list", values: [1, 2, 3, 4, 5] };
      } else if (select.value === "weekends") {
        builderState.dow = { kind: "list", values: [0, 6] };
      } else if (select.value === "only") {
        const current = builderState.dow;
        builderState.dow =
          current.kind === "list" && current.values.length > 0
            ? current
            : { kind: "list", values: [1] };
      } else {
        const current = builderState.dow;
        if (current.kind !== "custom") {
          builderState.dow = { kind: "custom", token: serializeChoice("dow", current) };
        }
      }
      syncRows();
      commitBuilder();
    });
  }

  const syncNumberRow = (config: NumberRowConfig): void => {
    const ui = rowUI[config.key];
    const choice = builderState[config.key];
    setCustomOption(ui.select, choice.kind === "custom" ? choice.token : null);
    if (choice.kind === "step") {
      ui.select.value = "step";
      configureNumberInput(config, "step", ui.input!, ui.suffix!);
      ui.input!.value = String(choice.step);
      ui.extra.hidden = false;
      return;
    }
    if (choice.kind === "value") {
      ui.select.value = "value";
      configureNumberInput(config, "value", ui.input!, ui.suffix!);
      ui.input!.value = String(choice.value);
      ui.extra.hidden = false;
      return;
    }
    ui.select.value = choice.kind === "custom" ? "custom" : "any";
    ui.extra.hidden = true;
  };

  const syncMonthRow = (): void => {
    const ui = rowUI.month;
    const choice = builderState.month;
    setCustomOption(ui.select, choice.kind === "custom" ? choice.token : null);
    if (choice.kind === "value") {
      ui.select.value = "value";
      ui.month!.value = String(choice.value);
      ui.extra.hidden = false;
      return;
    }
    ui.select.value = choice.kind === "custom" ? "custom" : "any";
    ui.extra.hidden = true;
  };

  const syncDowRow = (): void => {
    const ui = rowUI.dow;
    const choice = builderState.dow;
    setCustomOption(ui.select, choice.kind === "custom" ? choice.token : null);
    if (choice.kind === "list") {
      ui.select.value = isWeekdayList(choice)
        ? "weekdays"
        : isWeekendList(choice)
          ? "weekends"
          : "only";
      for (const button of ui.days!) {
        const day = Number(button.dataset.day);
        button.setAttribute("aria-pressed", String(choice.values.includes(day)));
      }
      ui.extra.hidden = false;
      return;
    }
    ui.select.value = choice.kind === "custom" ? "custom" : "any";
    ui.extra.hidden = true;
  };

  const syncRows = (): void => {
    NUMBER_ROWS.forEach(syncNumberRow);
    syncMonthRow();
    syncDowRow();
  };

  function updateBuildPreview(): void {
    buildExpression.textContent = composeCron(builderState);
  }

  function commitBuilder(): void {
    field.value = composeCron(builderState);
    updateBuildPreview();
    publish();
  }

  function setExpression(value: string): void {
    field.value = value;
    publish();
  }

  function hydrateBuilder(): void {
    const normalized = normalizeCron(field.value);
    builderState = parseBuilder(normalized);
    const parts = normalized ? normalized.split(/\s+/) : [];
    const custom =
      normalized !== "" && (parts.length !== 5 || hasCustomChoice(builderState));
    buildNote.hidden = !custom;
    buildNote.textContent = custom
      ? "This expression is custom. Changing a choice below replaces it with a simple schedule."
      : "";
    syncRows();
    updateBuildPreview();
  }

  let mode: "type" | "build" = "type";
  let fieldFocused = false;

  function setMode(next: "type" | "build"): void {
    mode = next;
    for (const button of modeButtons) {
      const active = button.dataset.mode === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    }
    typePanel.hidden = next !== "type";
    buildPanel.hidden = next !== "build";
    typeActions.hidden = next !== "type";
    buildActions.hidden = next !== "build";
    if (next === "build") hydrateBuilder();
  }

  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      const next = button.dataset.mode === "build" ? "build" : "type";
      setMode(next);
    });
  }

  must<HTMLButtonElement>(root, '[data-action="edit"]').addEventListener("click", () => {
    setMode("type");
    field.focus();
  });

  const buttons = CRON_PRESETS.map((preset) => {
    const button = element("button", "preset", preset.label);
    button.type = "button";
    button.addEventListener("click", () => setExpression(preset.value));
    return button;
  });

  const lucky = element("button", "preset", "I'm feeling lucky");
  lucky.type = "button";
  lucky.dataset.lucky = "true";
  lucky.addEventListener("click", () => setExpression(randomCron(field.value, random)));

  buttons.forEach((button, index) => {
    if (index > 0) presets.append(element("span", "presets__dot", "·"));
    presets.append(button);
  });
  presets.append(element("span", "presets__dot", "·"), lucky);

  const typingHint =
    "Keep typing — five fields separated by spaces: minute, hour, day, month, weekday.";

  function publish(): void {
    const normalized = normalizeCron(field.value);
    const state = evaluateCron(normalized, now());
    const stillTyping =
      fieldFocused && state.status === "invalid" && state.parts.length < 5;

    if (stillTyping) {
      sentence.textContent = typingHint;
      sentence.classList.remove("is-error");
      sentence.classList.add("is-hint");
      field.setAttribute("aria-invalid", "false");
    } else {
      sentence.textContent = state.sentence;
      sentence.classList.toggle("is-error", state.status === "invalid");
      sentence.classList.toggle("is-hint", state.status === "empty");
      field.setAttribute("aria-invalid", state.status === "invalid" ? "true" : "false");
    }

    renderTokens(tokens, state);
    if (state.nextExecution) {
      next.hidden = false;
      next.textContent = `Next run: ${state.nextExecution}`;
    } else {
      next.hidden = true;
      next.textContent = "";
    }
    buttons.forEach((button, index) => {
      button.classList.toggle("is-selected", CRON_PRESETS[index].value === state.normalized);
    });
    if (mode === "build") updateBuildPreview();
  }

  field.addEventListener("focus", () => {
    fieldFocused = true;
    publish();
  });

  field.addEventListener("input", publish);
  field.addEventListener("blur", () => {
    fieldFocused = false;
    const normalized = normalizeCron(field.value);
    if (normalized !== field.value) {
      field.value = normalized;
      field.setSelectionRange(normalized.length, normalized.length);
    }
    publish();
  });

  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      field.blur();
    }
  });

  setMode("type");
  publish();
}

const app = document.querySelector<HTMLElement>("#app");
if (app) mountCronApp(app);
