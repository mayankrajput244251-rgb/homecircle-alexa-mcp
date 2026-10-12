# Privacy and safety boundaries

HomeCircle is a hackathon demonstration for coordinating fictional family routines. It is not a clinical product, emergency system, or real messaging service.

## Data

- The sample members and routines are fictional.
- The self-hosted server persists its local demo state to data/state.json, which is excluded from Git.
- The server binds to 127.0.0.1 by default. This keeps the demo local unless the operator deliberately changes the host.
- There is no analytics, telemetry, model API, contact sync, or external storage.
- Browser-only demo changes are held in memory and disappear when the page is closed.

## Human review

The assistant can prepare a caregiver alert preview. The preview identifies the intended recipient, the routine, and the reason. A separate confirmation is required. The confirmation only writes a local demo timeline entry; it does not send SMS, email, calls, push notifications, or any other message.

## Safe use

- Do not use the demo to decide whether someone is medically safe.
- Do not interpret a missed check-in as an emergency or as proof that something happened.
- Do not put real names, medical records, medication instructions, phone numbers, or private notes in the demo.
- In a real concern, contact the person or appropriate local emergency services directly.
- Do not expose the local server to the public internet without a proper identity, authorization, rate-limiting, and data-protection design.

## Future work before a real deployment

Authentication and household membership, encrypted storage, explicit consent and revocation, audit retention controls, accessible notification channels, delivery receipts, rate limits, abuse prevention, backup and deletion workflows, and professional privacy/legal review would all be required. The current project intentionally implements none of those external actions.
