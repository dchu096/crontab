# Cron expression page

## Intent

crontab.tk is a single page for one job: a cron expression. It was split out of a larger utilities toolbox so the visit is only that job. Someone who already has a cron types or pastes it and immediately sees what it means and when it runs next. If they do not have one, a few common presets and I'm feeling lucky fill the same line.

The look is new. It does not reuse the toolbox layout, cards, chips, field grid, or help panel. The parsing and the answer are as reliable as the cron tool in that toolbox.

## Goals

- One dark page. The expression is the page.
- A plain-English sentence, then one next execution time, as soon as the line is valid.
- Four common presets and I'm feeling lucky.
- When the line is wrong, the bad part turns red and the sentence says why.
- The same five-field cron language the reference tool accepts, including names, steps, lists, ranges, and the `/5` shorthand.

## Non-goals

- Any other utility, route, or account.
- A field-by-field builder, dropdowns, or a syntax cheat sheet.
- More than one upcoming run.
- A copy button, a light theme, or sharing the expression in the URL.
- Six- or seven-field cron, or Quartz tokens such as `?`, `L`, `W`, and `#`.

## Anti-goals

- A page that looks like the old toolbox tool.
- A calendar or a list of runs as the hero.
- A next execution time shown for an invalid expression.

## Decisions

These are settled.

- Primary use: the visitor already has a cron in mind.
- I'm feeling lucky inserts any valid cron, including an odd one. Each use is a different expression from the one on screen.
- Layout is one centered line, with little chrome.
- The next run is a single time, labeled `Next execution time:`.
- The page is dark. Words use normal capitalization.
- The nav has `crontab.tk` on the left and `Cron expression` in the middle. The right side is empty so the title stays centered.
- Presets, in order: Every 5 minutes (`*/5 * * * *`), Every hour (`0 * * * *`), Weekdays at 9:00 (`0 9 * * 1-5`), First of the month (`0 0 1 * *`, midnight on the 1st), then I'm feeling lucky.
- A wrong field is red. The sentence is replaced by the reason. The next execution time is absent until the line is valid.
- If the line does not have five fields, the whole expression is red and the sentence names the five fields.
- If more than one field is wrong, every wrong field is red and the sentence explains the first one, in field order.
- The reason uses the same type and color as a normal sentence. Only the bad part of the expression is red.
- Before any input, the expression is empty and the sentence is `Enter a cron expression.`
- Clicking the expression selects its text so it can be copied from the line.
- The next time is the visitor's local date and clock. The timezone name is not printed.
- This is the existing Vite and TypeScript app in this folder.

## Page

One screen. Dark background `#12110f`. No cards, bordered chips, or icons.

The nav is a single row on the same background. Left: `crontab.tk`. Center: `Cron expression`, small and quiet. Right: nothing.

The expression sits in the middle, large, monospace, letterspaced, color `#f7f3ea`. It is an editable text field the whole time. Under it, the sentence is set in a serif, off-white, and is the main reading. Under that, when the line is valid, one muted line in a sans serif:

`Next execution time: Mon 26 Oct, 09:00`

The bottom row is plain words in muted type, separated by middots:

Every 5 minutes · Every hour · Weekdays at 9:00 · First of the month · I'm feeling lucky

On a narrow viewport the expression shrinks or wraps so it stays on screen, and the bottom row may wrap. The title stays centered.

The browser title is `Cron expression · crontab.tk`. The expression field's accessible name is `Cron expression`. When the line is invalid, the reason is announced with the field.

## States

**Empty.** The field is empty. There is no ghost expression. The sentence is `Enter a cron expression.` The next-execution line is not rendered. Nothing is red.

**Valid.** The sentence is the plain-English reading. The next-execution line is rendered. If the normalized expression equals a preset, that preset's words are the bright text color. I'm feeling lucky is never shown as selected.

**Invalid.** The next-execution line is not rendered. The bad field token or tokens are `#ff5c5c`. The other tokens stay `#f7f3ea`. Spaces between fields stay the normal color. The sentence is the reason, in the normal sentence color.

A field token is one whitespace-delimited piece after normalization. In `1,99` the whole token is red, not only `99`.

## Interaction

Each keystroke updates the sentence and the next time. There is no submit control.

Choosing a preset replaces the expression with that preset's value and runs the same path. I'm feeling lucky replaces the expression with a new valid cron and runs the same path.

Clicking the expression selects its current text. The field stays editable.

## Parsing

The behavior reference is `C:\Users\danie\Downloads\utils\src\components\CronGenerator.tsx`. Match what it accepts. Do not copy its layout. Use `cron-parser` `^5.5.0` (`CronExpressionParser.parse`) and `cronstrue` `^2.59.0`.

Normalization, applied to what the visitor typed before validation, and written back into the field:

- Trim.
- Uppercase.
- If the string starts with `/` and digits, rewrite that prefix from `/5` to `*/5`.
- If there is no whitespace and the string is two to five asterisks, split it into single stars joined by spaces. `*****` becomes `* * * * *`.
- Collapse whitespace to single spaces.

Keep the caret as stable as that rewrite allows.

Fields, in order: minute, hour, day of the month, month, day of the week.

| Field | Numbers | Names |
| --- | --- | --- |
| Minute | 0–59 | |
| Hour | 0–23 | |
| Day of the month | 1–31 | |
| Month | 1–12 | `JAN`–`DEC` |
| Day of the week | 0–7 | `SUN`–`SAT`, with `SUN` = 0 and `SAT` = 6 |

A token is valid when it is `*`, a step `*/n` where `n` is an integer greater than 0, a range `start-end` whose ends are in range and `start` is less than or equal to `end`, a comma-separated list of valid pieces, or a single in-range number or name. Ends of a range may be numbers or names.

Then `CronExpressionParser.parse` must succeed on the normalized string. The sentence for a valid line is `cronstrue.toString(normalized, { use24HourTimeFormat: true })`.

The next instant comes from `parse(normalized).next().toDate()`, shown in the local timezone. Format: short weekday, numeric day, short month, 24-hour clock with minutes. Shape: `Mon 26 Oct, 09:00`. Weekday and month names may follow the visitor's locale. The clock stays 24-hour. Do not append a timezone name.

If the parser accepts the line and cronstrue throws, the expression is not marked red, the next-execution line still shows, and the sentence is `Unable to read this cron expression.`

## Reasons

Use these sentences. Do not invent a second style.

- Not five fields: `A cron expression needs five fields: minute, hour, day of the month, month, and day of the week.` The whole expression is red.
- Minute out of range, unknown, or otherwise not a valid minute token, except the step and reversed-range cases below: `Minute must be from 0 to 59.`
- Hour, same: `Hour must be from 0 to 23.`
- Day of the month, same: `Day of the month must be from 1 to 31.`
- Month, same: `Month must be from 1 to 12, or JAN–DEC.`
- Day of the week, same: `Day of the week must be from 0 to 7, or SUN–SAT.`
- A step that is missing, zero, or not an integer: `{Field} step must be a number greater than 0.` That field is red. `{Field}` is Minute, Hour, Day of the month, Month, or Day of the week.
- A range whose start is greater than its end: `{Field} range must go from low to high.` That field is red.
- The five fields are individually valid and the parser still throws: the whole expression is red. The sentence is the parser error message. If that message is empty, `Unable to parse cron expression.`

When several fields fail, color each failed field and use the reason for the earliest field.

`25` in the hour is the approved example: the token `25` is red and the sentence is `Hour must be from 0 to 23.`

## I'm feeling lucky

Produce a five-field expression that passes the rules above and `CronExpressionParser.parse`. It must differ from the normalized expression currently shown. Odd schedules are allowed. Names are allowed and not required.

Generate by choosing each field independently from `*`, an in-range number, a legal step, a low-to-high range, or a short list of in-range values. Try up to 20 times. If none differ from the current line, use `0 * * * *` when that is not already showing, otherwise `*/5 * * * *`.

## Stack

Replace the Vite starter in this folder. TypeScript, no React, no router. Add `cron-parser` and `cronstrue` at the versions above. The page owns the document. There is no second view.

## Acceptance

- Empty page: no red, sentence `Enter a cron expression.`, no next-execution line.
- `*/5 * * * *` reads as every 5 minutes and shows one next time.
- `0 9 * * 1-5` and `0 9 * * MON-FRI` both produce a weekday 09:00 reading and a next time.
- `0 25 * * 1-5` colors only `25` and says `Hour must be from 0 to 23.`
- `0 25 * * 25` colors `25` and `25`, and the sentence is the hour reason.
- `0 9 * *` colors the whole line and names the five fields.
- `/5 * * * *` is rewritten to `*/5 * * * *` and treated as valid.
- `*****` is rewritten to `* * * * *` and treated as valid.
- `10-2 * * * *` says the minute range must go from low to high, and only that field is red.
- `*/0 * * * *` says the minute step must be a number greater than 0.
- Each preset fills the matching expression.
- I'm feeling lucky, used several times, only ever leaves a valid expression, and does not repeat the expression that was just showing.
- Clicking the expression selects its text.
- The next time uses a 24-hour clock and does not include a timezone name.

## Calls made here

- The centered title is `Cron expression`.
- The right side of the nav is empty.
- The four preset expressions and their labels are the ones listed above. First of the month is midnight.
- The empty sentence is `Enter a cron expression.` There is no placeholder cron.
- Copying is done by clicking the expression. There is no copy button.
- The clock is 24-hour so it matches the sentence. The timezone name is omitted.
- The sentence is a serif. The expression is monospace. The nav, next time, and presets are a sans serif.
- Colors are `#12110f`, `#f7f3ea`, muted warm gray, and `#ff5c5c`.
- A wrong field is the whole whitespace-delimited token.
- Reversed ranges and bad steps get their own reasons. Other invalid tokens get the field's range, including names for month and day of the week.
- A parser failure after the five fields look valid colors the whole line and shows the parser message.
- If cronstrue fails after a successful parse, the next time still shows and the sentence is `Unable to read this cron expression.`
- Lucky's generator shape and the 20-try fallback are as written above.
- A preset whose expression matches the field is shown brighter.
- The browser title is `Cron expression · crontab.tk`.
- Normalization is written back into the field, as the reference tool does.
