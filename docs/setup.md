# Setup and deployment

## Secrets
Copy `.env.example` to `.dev.vars`. Set `OPENAI_API_KEY` and optionally `EXA_API_KEY` / `AITINKERERS_API_KEY`. Keep the file readable only by your user (`chmod 600 .dev.vars` on macOS/Linux). Never put secrets in `NEXT_PUBLIC_*`, source code, README examples or Git remotes.

For a hosted instance, configure the same names in ChatGPT Sites server-side Secrets. They are not browser credentials and must not be shipped to the client. Your OpenAI API billing and rate limits are separate from a ChatGPT subscription.

## Sample runbook
The repository uses a fictional September 14, 2030 event. Replace the runbook, event date/timezone and initial facts with your own approved material in a private working copy. Keep private material outside any public repository and its Git history.

## Local database
Build once to generate the local Workers configuration, then initialize its database:

```sh
npm run build
npx wrangler d1 execute DB --config dist/server/wrangler.json --local --persist-to .wrangler/state --file drizzle/0000_optimal_kronos.sql
```

Then run `npm run dev`. The SQL contains schema only, no records. Development uses the same `.wrangler/state` directory. The database is local, not the owner’s production database.

## AI Tinkerers (optional)
Use an authorized read-only Agent API key. Set the appropriate event identifiers in `lib/tinkerers-mcp.ts` and the matching participant-validation identifier in `lib/participants.ts`, and update corresponding tests. Placeholder IDs intentionally cannot read the original event. The portal deadline and operational submission target are separate facts and should be configured for your event. No key means cached sample facts only, clearly marked fictional.

## Exa (optional)
Set `EXA_API_KEY`. Only public queries are sent to `https://api.exa.ai/search`; private notes and attendee profiles must not be searched or enriched. Search can incur Exa usage charges and is subject to your account's allowance. Missing key or failures must not break notes, voice or event tools.

## Hosting
Import this project using ChatGPT Sites. Register a new Site (do not copy the original production ID), retain logical `DB` binding and migrations, configure Secrets, build and publish privately first. Keep the platform authentication layer: the raw Worker trusts platform-injected identity headers and must not be exposed directly to untrusted traffic without an equivalent trusted authentication gateway.

The optional public source repository and the private operational Site are independent publication surfaces.
