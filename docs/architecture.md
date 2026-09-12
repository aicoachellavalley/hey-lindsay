# Architecture

Four distinct information sources stay separate:

1. **Runbook:** stable event facts; GPT-Live answers directly.
2. **Live event state:** read-only AI Tinkerers MCP results, cached with original source and retrieval time. Failed retrieval never advances a snapshot timestamp.
3. **Organizer memory:** authenticated, user-scoped D1 records. A write is acknowledged only after persistence succeeds; operation IDs prevent duplicate writes.
4. **Public web:** optional Exa search, for external public information only. Public pages cannot override the runbook or trigger writes.

`lib/agent.js` defines the Live persona, delegated instructions and tool schemas. `lib/voice.js` establishes WebRTC, handles microphone/output state and reconnect. `lib/live-bridge.js` returns completed function results before resuming delegated Responses work.

`lib/server.ts` validates user/session and tool arguments. `lib/live-web.js` calls a fixed Exa endpoint with query/options only; it does not serialize conversation context, notes or attendees. Private note/profile text is compared locally to reject likely accidental disclosure. Known contact/credential/roster patterns are blocked. These defensive checks cannot prove that arbitrary natural-language input contains no private information; the agent is also instructed never to derive searches from private data.

Exa: three bounded results, HTTPS source URLs, short excerpts and search retrieval timestamp. Six-second request timeout, response-size cap, short in-memory cache, no automatic retries, and Retry-After cooldown. No key means no registered search tool. Search failures are ordinary tool results and do not terminate voice.

The AI Tinkerers connector is an HTTP MCP client scoped to one authorized event. It minimizes attendee fields, strips contact strings and uses a short-lived profile cache. Browser cookies are never used.
