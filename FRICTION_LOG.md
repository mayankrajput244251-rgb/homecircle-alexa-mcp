# Friction Log — HomeCircle Alexa+ MCP Testing

## Task attempted
Demonstrate the HomeCircle experience publicly while validating the self-hosted MCP server path.

## Steps taken
1. Opened the hosted HomeCircle demo and tried the household coordination flows.
2. Reviewed the local setup instructions for running the MCP server and connecting the dashboard to it.
3. Compared what can be tested in the hosted browser demo with what requires the local server.

## Expected result
The public demo would exercise the same MCP server and tool calls used by the locally running project, so a judge could verify the full experience from one link.

## Actual result
The hosted page runs an explicitly labeled browser-only simulation. It demonstrates the interface but does not connect to the visitor's local MCP server. To test the MCP endpoint and server-side tools, a reviewer must clone the repository and run the project locally.

## Severity
Moderate — the public demo is usable, but testing the complete MCP integration requires an additional local setup step.

## Workaround used
Use the hosted demo to review the interaction flow, and follow the repository's setup instructions to run the server locally for MCP testing.

## Actionable suggestion
Provide a hosted Alexa+ / MCP testing sandbox where developers can safely register a Streamable HTTP endpoint, inspect initialization and tool discovery, and view tool-call results and errors. This would let judges validate the integration without needing to configure a local environment.
