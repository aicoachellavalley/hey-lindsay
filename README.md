# HEY LINDSAY
**Your on-hand coordinator.**

A voice-first operational assistant for someone running a live event. Ask for the next deadline, remember a problem, recall an organizer note, or check an authorized event system without opening a chat box.

Built for **Agents, Everywhere** at AI Tinkerers Coachella Valley. The broader idea serves wedding planners, film coordinators, conference producers and other people who need answers while moving.

## Try the project
Hosted Site: **https://hey-lindsay.sunshinefm.chatgpt.site/**

The hosted operational instance is private and requires its owner's ChatGPT login. This public source repository does not grant access to private notes or attendee records. Judges can review the code, run the fictional sample locally with their own API credentials, or see the organizer's live demonstration. No live attendee data or operational runbook is included here.

## Two-minute demo
1. **0:00–0:15** — Tap “Talk to Lindsay.” Explain: “An on-hand coordinator for someone physically running an event.”
2. **0:15–0:35** — Ask: “What happens at 3:30?” Lindsay answers from the fictional sample runbook: stop building and prepare submissions.
3. **0:35–1:00** — Say: “Save a note: check the projector before show-and-tell.” Confirm it appears in Notes.
4. **1:00–1:20** — Ask: “What did I ask you to remember?” Lindsay reads the saved note. Interrupt naturally to demonstrate conversational control.
5. **1:20–1:40** — Optional Exa: “Find public information on HDMI adapters near Palm Desert.” Lindsay gives a concise sourced answer, without promising stock availability. Without an Exa key, skip this step; the core demo remains useful.
6. **1:40–2:00** — Ask an unknown event question. Lindsay admits the information is missing. End/reconnect and recall the saved note to demonstrate persistence.

**Why it fits the theme:** voice is the working surface, and the agent can execute a real structured write or query an operational system. It is a coordinator that fits into activity away from a keyboard.

## What works
- GPT-Live-1 speech-to-speech over WebRTC; concise answers and interruption.
- Stable facts in compact startup context, avoiding unnecessary delegation.
- GPT-5.6 Luna handles tool selection; server validates actions and permissions.
- Persistent notes, reminder entries and person/team issues in D1; reminders do not send notifications.
- Optional, read-only AI Tinkerers MCP: attendance, teams, submissions, deadlines and authorized profile excerpts.
- Optional Exa public web search through `search_live_web(query)`; separate from ordinary event questions.
- Safe diagnostic metadata, cooldowns and explicit failed-action handling.

The Pixel/Chrome voice flow was reported working by the organizer. Background or locked-screen operation is not guaranteed.

## Architecture
```text
Phone Chrome microphone ⇄ GPT-Live-1 voice
                              │ delegates only when needed
                              ▼
                        GPT-5.6 Luna
                              │ function call
                              ▼
               Authenticated Sites server /api/tools
                  ├── D1 organizer memory
                  ├── AI Tinkerers official MCP (optional)
                  └── Exa Search API (optional)
                              │ verified, compact result
                              └── Luna → GPT-Live speaks
```

More detail: [architecture](docs/architecture.md), [setup](docs/setup.md), [limitations](docs/limitations.md), [security audit](docs/security.md).

## Local setup
Requires Node **22.13+** (Node 24+ recommended for the TypeScript test runner), npm, and your own OpenAI API project with GPT-Live-1 and GPT-5.6 Luna access and billing.

```sh
npm ci
cp .env.example .dev.vars
# Edit .dev.vars locally; never commit it.
npm run build
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --persist-to .wrangler/state --file drizzle/0000_optimal_kronos.sql
npm run dev
```

Open **http://localhost:5173** and use the local sign-in link. The supplied development plugin only simulates a user on loopback; production authentication is provided by ChatGPT Sites. Initialize the local database schema as described in [setup](docs/setup.md) before using notes or voice sessions.

`OPENAI_API_KEY` powers voice/delegation. `EXA_API_KEY` is optional. Without it, Exa is not offered to the model. `AITINKERERS_API_KEY` is optional and will not work until you configure your own authorized event identifiers. Never reuse someone else's event identifiers or credentials.

```sh
npm test
npm run typecheck
npm run build
```

Tests use synthetic data and mocked HTTP responses; they make no paid API requests. Build output and local databases are ignored by Git.

## Public vs. operational configuration
- `runbook.md` and `lib/event-state.ts` contain **fictional sample data only**.
- AI Tinkerers identifiers in connector code and tests are placeholders.
- `.openai/hosting.json` includes logical storage bindings only, with **no production Site ID**. To deploy your own Site, have ChatGPT Sites register this project, assign its own ID/storage/auth, and configure server-side secrets.
- No original Git history, private source-audit documents, attendee exports, saved notes, local databases or API credentials are included.
- Public source does not make the owner's operational Site public.

## Components and documentation
- [GPT-Live delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)
- [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [ChatGPT Sites](https://learn.chatgpt.com/docs/sites)
- [Exa Search API](https://exa.ai/docs/reference/search)

Stack: TypeScript, React, Vinext/Vite, Cloudflare Workers-compatible runtime, D1 and ChatGPT Sites hosting/auth. Dependency and vendored-component licenses remain in their original files.
