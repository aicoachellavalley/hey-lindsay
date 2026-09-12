# Organizer messages

Use **Update Lindsay** below the voice controls. Paste a relevant organizer email or chat message, enter its source and date, review up to three extracted decisions, edit if needed, then confirm. Conflicts are preserved for clarification rather than silently replacing the runbook.

Only confirmed summaries are stored in the signed-in user’s existing private D1 notes. Raw message text is processed by OpenAI with `store:false`, never sent to Exa or stored in the application database. Common contact patterns are removed; users should omit unnecessary sensitive details. No inbox connection, attachments, forwarding address, or automatic email monitoring is included.

The five latest organizer summaries enter voice startup context; older summaries remain in Notes and within the existing bounded note-retrieval window. New updates are sent to an active conversation on the same page. If adding on a different device, reconnect that device’s conversation to load the latest updates. Each email should contain a focused decision; break long threads into separate relevant messages.

Validation: synthetic message extraction and conflict warning, UI confirmation, reload persistence, owner isolation, duplicate-save idempotency, origin/sign-in rejection, and voice startup context. No production messages were used as test fixtures.
