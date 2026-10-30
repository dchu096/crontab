# crontab.tk

Cron expression generator for the five-field crontab format (`minute hour dom month dow`).

Build schedules with field pickers, presets, or plain typing. Get a human-readable explanation, next run times, and a copyable expression. Light/dark theme included.

Live site: [crontab.tk](https://crontab.tk)

## Stack

- Vite + TypeScript
- [cron-parser](https://github.com/harrisiirak/cron-parser) for next-run evaluation
- [cronstrue](https://github.com/bradymholt/cronstrue) for natural-language descriptions

## Develop

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

## Credits

yes, cursor made it, i dont hide.

Built with:

- **Cursor** — Grok 4.7
- **Qoder** — DeepSeek-v4.1-flash
