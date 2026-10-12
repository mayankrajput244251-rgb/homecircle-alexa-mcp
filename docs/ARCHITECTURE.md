# Architecture

## Components

1. Browser dashboard: one responsive HTML page with searchable/filterable routine planning, member management, household insights, preference controls, and an explicit JSON export. It tries the same-origin MCP endpoint and switches to a clearly labeled browser-local simulation when the endpoint is absent.
2. MCP server: Node.js HTTP server on loopback. It handles initialize, notifications, tools/list, tools/call, session IDs, and Streamable HTTP JSON responses.
3. Tool layer: validates arguments, updates household routines, and returns structured results with evidence and safety notices.
4. Local state store: atomic JSON writes to data/state.json. The file is ignored by Git and can be relocated with HOMECIRCLE_STATE_FILE.
5. Confirmation store: pending alert previews are held in server memory with a five-minute expiry. Confirmation records a local timeline entry only.

## Request flow

The browser opens a Streamable HTTP session, sends initialize with protocol version 2025-11-25, sends notifications/initialized, and calls tools/list. The 13 tools cover routine search/filter data, check-ins, routine lifecycle management, member onboarding, household insights, preferences, user-requested exports, and review-only alert previews. Each resulting update passes through the same tool validation layer used by external MCP clients.

Read-only calls return structured household data. Writes validate IDs and fields before modifying state. Routines support active, paused, completed, and archived states. Archiving hides a routine from the active planner but keeps the routine and its timeline history available to an explicit archived filter. Insights are computed from the current local state, not a remote analytics service. An export returns a JSON snapshot after a direct user action. An alert is a two-step operation: prepare creates a short-lived preview; confirm consumes that preview once and records an event with externalMessageSent=false.

## State lifecycle

On first startup, the server writes fictional seed data. Mutations are serialized as a complete JSON document to a temporary sibling file and atomically renamed into place. The file is local demo state, not a multi-user database. Concurrent server instances must not share one state file.

## Trust boundaries

- Same-origin browser access and loopback origins are allowed; non-local browser origins are rejected by the MCP HTTP endpoint.
- MCP sessions are random opaque values held in memory and must be initialized before tool calls.
- Tool arguments are schema-described and also validated server-side.
- The server is deliberately bound to 127.0.0.1 by default.
- The confirmation preview is not a real notification queue.
- Browser simulation is separate from server persistence, saved in local storage, and labeled in the interface.

## Extensions

A production design could add authenticated households, real notification adapters, role-based consent, D1/Postgres persistence, scheduled routines, and audit controls. Those capabilities should be added only with explicit user permission and appropriate security review. They are intentionally outside this demo.
