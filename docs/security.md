# Public source security review

Publication uses a new repository with a single sanitized starting commit. It does not share history with the operational checkout.

Included: application code, schema-only database migrations, synthetic tests, fictional runbook/facts, empty environment-variable examples and required dependency attributions.

Excluded: credentials, browser/session tokens, private source documents, real event identifiers, attendee records, saved organizer notes, local databases, QA recordings, build artifacts and production Site identity/configuration.

Before the initial push, the working tree and all Git objects reachable from its fresh history are checked for known configured secret values and credential patterns. Expected sample emails are confined to synthetic tests and local development authentication. The dependency lockfile is checked for authenticated package URLs. These checks supplement manual file review; they are not a guarantee against every possible secret or vulnerability.

Runtime boundaries: authenticated user/session, origin checks, schema-validated tools, idempotent note writes, bounded read-only connectors, public-query-only Exa payloads and metadata-only diagnostics. Never deploy the raw Worker without trusted authentication in front of its identity headers.
