import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROTOCOL_VERSION = '2025-11-25';
export const ACTION_TTL_MS = 5 * 60 * 1000;
const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4319);
const HOST = process.env.HOST || '127.0.0.1';
const STATE_FILE = process.env.HOMECIRCLE_STATE_FILE || join(ROOT, 'data', 'state.json');
const WEB_ROOT = join(ROOT, 'public');

const isoNow = () => new Date().toISOString();
const clone = (value) => structuredClone(value);

export function createInitialState() {
  return {
    schemaVersion: 1,
    home: { id: 'home-demo', name: 'The Kumar Family', timezone: 'Asia/Kolkata', privacyMode: 'local-demo' },
    members: [
      { id: 'maya', name: 'Maya', role: 'Family member', initials: 'MK', color: '#c5a8ff' },
      { id: 'arjun', name: 'Arjun', role: 'Care partner', initials: 'AK', color: '#67ddc0' },
      { id: 'nani', name: 'Nani', role: 'Family member', initials: 'NK', color: '#ffb56b' }
    ],
    routines: [
      { id: 'morning-check', title: 'Morning check-in', memberId: 'nani', category: 'Wellbeing', time: '08:30', repeat: 'Daily', note: 'A friendly hello and ask if anything is needed.', status: 'due', createdAt: isoNow(), lastCompletedAt: null },
      { id: 'water-reminder', title: 'Water break', memberId: 'nani', category: 'Daily rhythm', time: '11:00', repeat: 'Daily', note: 'Offer a gentle reminder; no health advice.', status: 'upcoming', createdAt: isoNow(), lastCompletedAt: null },
      { id: 'visit-prep', title: 'Prepare for family visit', memberId: 'maya', category: 'Family', time: '16:30', repeat: 'Today', note: 'Check the shared list and confirm the ride.', status: 'upcoming', createdAt: isoNow(), lastCompletedAt: null }
    ],
    activity: [
      { id: randomUUID(), type: 'note', memberId: 'arjun', text: 'Welcome to the HomeCircle demo. Sample routines are fictional.', at: isoNow() }
    ],
    preferences: { quietHours: { start: '21:00', end: '07:00' }, alertMode: 'confirm-before-sharing', sharingEnabled: false },
    escalationLog: []
  };
}

export async function loadState(path = STATE_FILE) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.members) || !Array.isArray(parsed.routines)) throw new Error('Unsupported state file.');
    return parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const fresh = createInitialState();
    await saveState(fresh, path);
    return fresh;
  }
}

export async function saveState(state, path = STATE_FILE) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

const text = (value, label, max = 240) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label} must be 1–${max} characters.`);
  return value.trim();
};
const memberById = (state, id) => {
  const member = state.members.find((item) => item.id === id);
  if (!member) throw new Error('Choose a family member from the demo household.');
  return member;
};
const routineById = (state, id) => {
  const routine = state.routines.find((item) => item.id === id);
  if (!routine) throw new Error('Routine not found. Refresh the dashboard and try again.');
  return routine;
};
function activity(state, type, memberId, message, now) {
  state.activity.unshift({ id: randomUUID(), type, memberId, text: message, at: new Date(now).toISOString() });
  state.activity = state.activity.slice(0, 100);
}
function result(data) { return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
function toolError(message) { return { isError: true, content: [{ type: 'text', text: message }] }; }

export const TOOL_DEFINITIONS = [
  { name: 'get_family_brief', title: 'Get family brief', description: 'Summarize household members, routines due today, completed check-ins, and privacy settings. Uses only local demo state.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'list_routines', title: 'List routines', description: 'List household routines, optionally filtered by member or status.', inputSchema: { type: 'object', additionalProperties: false, properties: { memberId: { type: 'string', description: 'Optional member ID.' }, status: { type: 'string', enum: ['due', 'upcoming', 'completed'], description: 'Optional routine status.' } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'log_check_in', title: 'Log a check-in', description: 'Record a completed, skipped, or needs-follow-up routine in the local shared activity timeline.', inputSchema: { type: 'object', additionalProperties: false, properties: { routineId: { type: 'string' }, memberId: { type: 'string' }, outcome: { type: 'string', enum: ['completed', 'skipped', 'needs_follow_up'] }, note: { type: 'string', maxLength: 240 } }, required: ['routineId', 'outcome'] }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'create_routine', title: 'Create a routine', description: 'Add a household routine. This changes only the local demo state; it does not send a notification.', inputSchema: { type: 'object', additionalProperties: false, properties: { title: { type: 'string', maxLength: 80 }, memberId: { type: 'string' }, category: { type: 'string', maxLength: 40 }, time: { type: 'string', description: '24-hour HH:MM time.' }, repeat: { type: 'string', enum: ['Daily', 'Weekdays', 'Weekly', 'Today'] }, note: { type: 'string', maxLength: 240 } }, required: ['title', 'memberId', 'time', 'repeat'] }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'prepare_caregiver_alert', title: 'Prepare caregiver alert', description: 'Prepare a private, reviewable alert preview for a care partner. Nothing is shared or sent until a separate confirmation call.', inputSchema: { type: 'object', additionalProperties: false, properties: { routineId: { type: 'string' }, reason: { type: 'string', maxLength: 240 } }, required: ['routineId', 'reason'] }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'confirm_caregiver_alert', title: 'Confirm caregiver alert', description: 'Confirm or discard a pending local demo alert. Confirmation records the event in the local timeline only; it never sends a real message.', inputSchema: { type: 'object', additionalProperties: false, properties: { actionId: { type: 'string' }, confirmed: { type: 'boolean' } }, required: ['actionId', 'confirmed'] }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } },
  { name: 'get_activity_timeline', title: 'Get activity timeline', description: 'Read recent family check-ins and demo events.', inputSchema: { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 30 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } },
  { name: 'update_family_preference', title: 'Update family preference', description: 'Update local household preferences such as quiet hours. The change is visible and reversible.', inputSchema: { type: 'object', additionalProperties: false, properties: { quietStart: { type: 'string' }, quietEnd: { type: 'string' } }, required: ['quietStart', 'quietEnd'] }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } }
];

export function callTool(state, name, args = {}, now = Date.now(), pending = new Map()) {
  try {
    if (name === 'get_family_brief') {
      const completed = state.routines.filter((item) => item.status === 'completed').length;
      return result({ household: state.home.name, timezone: state.home.timezone, members: state.members.map(({ id, name, role }) => ({ id, name, role })), routines: { total: state.routines.length, due: state.routines.filter((item) => item.status === 'due').length, upcoming: state.routines.filter((item) => item.status === 'upcoming').length, completed }, privacy: { mode: state.home.privacyMode, alertMode: state.preferences.alertMode, sharingEnabled: state.preferences.sharingEnabled }, topItems: state.routines.filter((item) => item.status === 'due').slice(0, 3).map((item) => ({ id: item.id, title: item.title, member: memberById(state, item.memberId).name, time: item.time })), source: 'Local HomeCircle demo state', notice: 'Fictional demo information; not medical advice or an emergency service.' });
    }
    if (name === 'list_routines') {
      if (args.memberId) memberById(state, args.memberId);
      if (args.status && !['due', 'upcoming', 'completed'].includes(args.status)) throw new Error('Unknown status filter.');
      const routines = state.routines.filter((item) => (!args.memberId || item.memberId === args.memberId) && (!args.status || item.status === args.status)).map((item) => ({ ...item, memberName: memberById(state, item.memberId).name }));
      return result({ routines, count: routines.length, source: 'Local HomeCircle routine list' });
    }
    if (name === 'log_check_in') {
      const routine = routineById(state, args.routineId);
      const member = memberById(state, args.memberId || routine.memberId);
      if (!['completed', 'skipped', 'needs_follow_up'].includes(args.outcome)) throw new Error('Choose completed, skipped, or needs_follow_up.');
      const note = args.note ? text(args.note, 'Note', 240) : '';
      routine.status = args.outcome === 'completed' ? 'completed' : 'due';
      if (args.outcome === 'completed') routine.lastCompletedAt = new Date(now).toISOString();
      activity(state, args.outcome, member.id, `${member.name}: ${routine.title}${note ? ` — ${note}` : ''}`, now);
      return result({ ok: true, routine: { id: routine.id, title: routine.title, status: routine.status }, member: member.name, outcome: args.outcome, recordedAt: new Date(now).toISOString(), externalMessageSent: false, source: 'Local activity timeline' });
    }
    if (name === 'create_routine') {
      const title = text(args.title, 'Routine title', 80);
      const member = memberById(state, args.memberId);
      const time = text(args.time, 'Time', 5);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Time must use 24-hour HH:MM format.');
      if (!['Daily', 'Weekdays', 'Weekly', 'Today'].includes(args.repeat)) throw new Error('Choose Daily, Weekdays, Weekly, or Today.');
      const routine = { id: `routine-${randomUUID().slice(0, 8)}`, title, memberId: member.id, category: args.category ? text(args.category, 'Category', 40) : 'Family', time, repeat: args.repeat, note: args.note ? text(args.note, 'Note', 240) : '', status: 'upcoming', createdAt: new Date(now).toISOString(), lastCompletedAt: null };
      state.routines.unshift(routine);
      activity(state, 'routine_created', member.id, `New routine added: ${routine.title} for ${member.name}`, now);
      return result({ ok: true, routine: { ...routine, memberName: member.name }, notice: 'Added to local demo only. No reminder was sent.' });
    }
    if (name === 'prepare_caregiver_alert') {
      const routine = routineById(state, args.routineId);
      const reason = text(args.reason, 'Reason', 240);
      const member = memberById(state, routine.memberId);
      const actionId = randomUUID();
      const preview = { actionId, kind: 'caregiver_alert', recipient: 'Arjun · care partner', member: member.name, routine: routine.title, reason, expiresInSeconds: ACTION_TTL_MS / 1000, effect: 'Adds a private demo event to the activity timeline. No SMS, email, call, or push notification is sent.' };
      pending.set(actionId, { ...preview, expiresAt: now + ACTION_TTL_MS });
      return result(preview);
    }
    if (name === 'confirm_caregiver_alert') {
      if (typeof args.confirmed !== 'boolean') throw new Error('A confirmation choice is required.');
      const action = pending.get(args.actionId);
      if (!action || action.expiresAt <= now) { pending.delete(args.actionId); throw new Error('Preview expired or was already used. Prepare it again.'); }
      pending.delete(args.actionId);
      if (!args.confirmed) return result({ ok: true, status: 'discarded', externalMessageSent: false, notice: 'Preview discarded. Nothing was shared.' });
      state.escalationLog.unshift({ id: randomUUID(), at: new Date(now).toISOString(), recipient: action.recipient, member: action.member, routine: action.routine, reason: action.reason, status: 'simulated_confirmed' });
      activity(state, 'alert_preview_confirmed', null, `Demo alert preview confirmed for ${action.member}: ${action.routine}. No real message was sent.`, now);
      return result({ ok: true, status: 'simulated_confirmed', recipient: action.recipient, externalMessageSent: false, notice: 'Recorded locally for demonstration. No caregiver was contacted.' });
    }
    if (name === 'get_activity_timeline') {
      const limit = args.limit === undefined ? 12 : Number(args.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('Limit must be an integer from 1 to 30.');
      return result({ items: state.activity.slice(0, limit).map((item) => ({ ...item, memberName: item.memberId ? memberById(state, item.memberId).name : 'HomeCircle' })), count: Math.min(limit, state.activity.length), source: 'Local activity timeline' });
    }
    if (name === 'update_family_preference') {
      const start = text(args.quietStart, 'Quiet hours start', 5), end = text(args.quietEnd, 'Quiet hours end', 5);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) throw new Error('Quiet hours must use 24-hour HH:MM format.');
      state.preferences.quietHours = { start, end };
      activity(state, 'preference_updated', null, `Quiet hours changed to ${start}–${end}`, now);
      return result({ ok: true, quietHours: state.preferences.quietHours, notice: 'Saved in local demo state.' });
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) { return toolError(error.message); }
}

export function handleRpc(state, message, { now = Date.now(), pending = new Map() } = {}) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return { jsonrpc: '2.0', id: message?.id ?? null, error: { code: -32600, message: 'Invalid Request' } };
  const response = (id, resultValue) => ({ jsonrpc: '2.0', id, result: resultValue });
  if (message.method === 'notifications/initialized' || message.method === 'notifications/cancelled') return null;
  if (!Object.hasOwn(message, 'id')) return null;
  if (message.method === 'initialize') {
    if (message.params?.protocolVersion !== PROTOCOL_VERSION) return { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: `Unsupported protocol version. Use ${PROTOCOL_VERSION}.` } };
    return response(message.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'homecircle-family-coordinator', version: '1.0.0' }, instructions: 'Use tools for all household updates. All data is local fictional demo data. Never claim that a real person was contacted or that this is an emergency or medical service. Preview and confirm before simulated caregiver alerts.' });
  }
  if (message.method === 'ping') return response(message.id, {});
  if (message.method === 'tools/list') return response(message.id, { tools: TOOL_DEFINITIONS });
  if (message.method === 'tools/call') {
    const name = message.params?.name;
    if (!TOOL_DEFINITIONS.some((tool) => tool.name === name)) return { jsonrpc: '2.0', id: message.id, error: { code: -32602, message: `Unknown tool: ${name}` } };
    return response(message.id, callTool(state, name, message.params?.arguments || {}, now, pending));
  }
  return { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } };
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}
function originAllowed(origin) {
  if (!origin) return true;
  try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); } catch { return false; }
}

export function createHomeCircleServer({ state = createInitialState(), stateFile = STATE_FILE, host = HOST, port = PORT } = {}) {
  const sessions = new Map(), pending = new Map();
  const save = () => saveState(state, stateFile);
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (!originAllowed(origin)) return json(res, 403, { error: 'Origin is not allowed. Use the same origin or localhost.' });
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS' } : {};
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.url === '/health' && req.method === 'GET') return json(res, 200, { ok: true, app: 'HomeCircle', protocolVersion: PROTOCOL_VERSION, tools: TOOL_DEFINITIONS.length, privacyMode: state.home.privacyMode }, cors);
    if (req.url === '/mcp' && req.method === 'GET') { res.writeHead(405, { ...cors, Allow: 'POST, DELETE' }); return res.end(); }
    if (req.url === '/mcp' && req.method === 'POST') {
      if (!String(req.headers.accept || '').includes('application/json') || !String(req.headers.accept || '').includes('text/event-stream')) return json(res, 406, { error: 'Accept must include application/json and text/event-stream.' }, cors);
      if (!String(req.headers['content-type'] || '').includes('application/json')) return json(res, 415, { error: 'Content-Type must be application/json.' }, cors);
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 1_000_000) return json(res, 413, { error: 'Request is too large.' }, cors); }
      let message;
      try { message = JSON.parse(body); } catch { return json(res, 400, { error: 'Body must be valid JSON.' }, cors); }
      if (message.method !== 'initialize' && req.headers['mcp-protocol-version'] !== PROTOCOL_VERSION) return json(res, 400, { error: 'MCP-Protocol-Version must be ' + PROTOCOL_VERSION + '.' }, cors);
      let sessionId = req.headers['mcp-session-id'];
      if (message.method === 'initialize') { sessionId = randomUUID(); sessions.set(sessionId, { createdAt: Date.now() }); }
      else if (!sessionId || !sessions.has(sessionId)) return json(res, 404, { error: 'MCP session not found. Initialize a new session.' }, cors);
      const response = handleRpc(state, message, { pending });
      if (message.method === 'tools/call' && !response?.result?.isError) await save();
      if (!response) { res.writeHead(202, { ...cors, 'MCP-Session-Id': sessionId, 'MCP-Protocol-Version': PROTOCOL_VERSION }); return res.end(); }
      return json(res, 200, response, { ...cors, 'MCP-Session-Id': sessionId, 'MCP-Protocol-Version': PROTOCOL_VERSION });
    }
    if (req.url === '/mcp' && req.method === 'DELETE') {
      const id = req.headers['mcp-session-id'];
      if (!id || !sessions.delete(id)) return json(res, 404, { error: 'MCP session not found.' }, cors);
      res.writeHead(204, cors); return res.end();
    }
    if (req.method === 'GET' && req.url === '/') {
      try { const html = await readFile(join(WEB_ROOT, 'index.html')); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...cors }); return res.end(html); }
      catch { return json(res, 500, { error: 'HomeCircle web client is missing.' }, cors); }
    }
    if (req.method === 'GET' && req.url === '/favicon.svg') {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', ...cors }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="13" fill="#baf3df"/><path d="M8 20 20 9l12 11v11H8z" fill="#0d352b"/><path d="M16 31v-8h8v8" fill="none" stroke="#baf3df" stroke-width="2"/></svg>');
    }
    return json(res, 404, { error: 'Route not found.' }, cors);
  });
  return { server, listen: () => new Promise((resolve) => server.listen(port, host, () => resolve(server.address()))), close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())), state, sessions, pending };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const state = await loadState();
  const app = createHomeCircleServer({ state });
  const address = await app.listen();
  console.log(`HomeCircle running at http://${address.address}:${address.port}`);
  console.log(`MCP Streamable HTTP endpoint: http://${address.address}:${address.port}/mcp · protocol ${PROTOCOL_VERSION}`);
  console.log('Demo-only data; no external notifications or real care decisions are made.');
  const stop = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
