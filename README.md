# HomeCircle

**A family care coordination assistant for the Alexa+ track.** HomeCircle gives a household one calm place to plan simple routines, record check-ins, and prepare a caregiver alert for human review.

This is a separate project from the shop-floor copilot. It uses a self-hosted MCP server that implements Streamable HTTP with protocol version 2025-11-25, plus a browser dashboard that can run in local MCP mode or as a no-server interactive demo.

**Public browser demo:** https://homecircle-family-coordination.mayankrajput244251.chatgpt.site
The hosted page runs its labeled browser-only simulation. Run the project locally to connect the dashboard to the actual MCP server.

## Why HomeCircle

Families often coordinate small daily tasks across chats, calendars, and memory. HomeCircle keeps a shared routine list and an activity timeline together, so a family member can ask for a brief, mark a check-in, add a routine, or prepare an alert preview. The project is designed around consent: alert previews are never sent anywhere, and the interface says so before confirmation.

## Try it

Requirements: Node.js 20 or newer. There are no package dependencies and no API key is needed.

1. Clone this repository.
2. Run npm start.
3. Open http://127.0.0.1:4319.
4. Try “How is everyone doing today?”, “What routines are due?”, or “Prepare a caregiver alert”.
5. Use the dashboard’s Add routine and Mark done controls. For a caregiver alert, inspect the preview and confirm or discard it.

The first run creates a local data/state.json file. It contains fictional starter information and is ignored by Git. Set HOMECIRCLE_STATE_FILE to use a different path. The server binds to 127.0.0.1 by default so sample family data is not exposed on a network.

## Alexa+ / MCP integration

MCP endpoint: http://127.0.0.1:4319/mcp  
Health check: http://127.0.0.1:4319/health  
Protocol version: 2025-11-25  
Transport: Streamable HTTP with JSON-RPC 2.0

The web UI discovers the server tools at startup. The self-hosted server advertises eight tools:

| Tool | Purpose |
| --- | --- |
| get_family_brief | Summarize members, routines, check-ins, and privacy state |
| list_routines | Filter routines by member or status |
| log_check_in | Record a completed, skipped, or follow-up check-in |
| create_routine | Add a local household routine |
| prepare_caregiver_alert | Create a review-only alert preview |
| confirm_caregiver_alert | Confirm or discard a preview; confirmation is local-only |
| get_activity_timeline | Read recent household activity |
| update_family_preference | Change the demo quiet-hours preference |

An MCP client can connect to the URL above using Streamable HTTP. An example endpoint declaration is included in mcp-config.json. The demo client sends initialize with 2025-11-25, completes initialization, discovers tools, and calls them with structured arguments.

## Browser demo mode

When the page cannot reach a local MCP server, it switches to an explicitly labeled browser-only simulation. The sample routines and changes stay in the current browser session. This mode is useful for a public presentation; it does not use a backend, contact people, or send alerts.

## Safety and privacy boundaries

- All names, routines, activity, and events are fictional sample data.
- The local server stores state on the user's machine and defaults to loopback only.
- No SMS, email, phone call, push notification, or external system write is implemented.
- Confirming an alert records a demonstration event; it never contacts a caregiver.
- The project does not provide medical advice, medication dosing, diagnosis, or emergency response.
- A missed routine is a prompt to check context, not proof that a person is unsafe.
- No cloud AI, analytics, telemetry, or third-party API is used.

See PRIVACY_AND_SAFETY.md and docs/ARCHITECTURE.md for fuller details.

## Development

- npm test runs deterministic unit tests.
- npm run check checks the server syntax and runs the tests.
- Set PORT to change the default port 4319.
- Set HOST only when you understand the network exposure. The default is 127.0.0.1.
- Set HOMECIRCLE_STATE_FILE to move local demo persistence.

## Repository map

- server.mjs: MCP endpoint, local state, tool definitions, validation, and confirmation flow.
- public/index.html: responsive dashboard, chat-style interactions, and browser simulation.
- test/server.test.mjs: protocol, validation, confirmation, and persistence tests.
- docs/ARCHITECTURE.md: request flow and trust boundaries.
- docs/DEMO_SCRIPT.md: a concise judging walkthrough.
- PRIVACY_AND_SAFETY.md: scope and data-handling limitations.

## Hackathon project note

This repository is a new Alexa+ project. It uses MCP at runtime rather than only mentioning MCP in documentation. The browser demo is an optional presentation surface; the source includes the self-hosted tool server and its run instructions.

## License

MIT. See LICENSE.
