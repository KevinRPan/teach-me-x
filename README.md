# Learning Companion

A phone web app that builds a one-week learning plan, then keeps that week on the device: today’s steps, a check-off list, and a companion you can ask about the work.

## What you need running

The phone never talks to Gemini directly. A small Node server does two jobs:

1. **Holds the Gemini key.** Set `GEMINI_API_KEY` in the server environment. Leave it unset and the app runs in practice mode with example plans, so the phone flow still works.
2. **Saves the week.** Each browser gets an httpOnly cookie. The profile, chosen directions, plan, checkmarks, and chat are stored in SQLite (`data/companion.sqlite` by default). Closing the phone and coming back resumes the same week.

That is the backend this app needs. Accounts and a hosted database matter later, if the same week should follow someone across phones. One phone, one browser profile, is covered by the cookie and SQLite.

## Open it

On the computer that has this folder, `npm run dev` serves it at <http://127.0.0.1:5173>. That address only works on that computer.

On a phone, open <https://learning-companion.kevipan.workers.dev>. That copy opens in the browser and saves the week with a cookie in the D1 database `learning-companion`. Set the Worker secret `GEMINI_API_KEY` and the phone builds real plans. Leave it unset and the phone shows example plans.

A Cursor publish is a second host. It keeps each signed-in person’s week in its own database and reads the same secret name.

## Scripts

```bash
npm install
npm run dev      # API on :8787 and the phone UI on :5173
npm test
npm run build
npm start        # serves the built app and the API together
```

Copy `.env.example` to `.env` in this folder on the machine that runs the server. The server reads `GEMINI_API_KEY` from the environment, and from that file when the variable is not already set.

On a phone, use the installed site (Add to Home Screen). The manifest, theme color, and safe-area padding are set up for that.
