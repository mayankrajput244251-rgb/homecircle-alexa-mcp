import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInitialState, callTool, handleRpc, TOOL_DEFINITIONS, loadState, saveState } from '../server.mjs';

test('MCP advertises the target protocol and eight tools', () => {
  const init = handleRpc(createInitialState(), { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
  assert.equal(init.result.protocolVersion, '2025-11-25');
  assert.equal(TOOL_DEFINITIONS.length, 8);
  assert.equal(handleRpc(createInitialState(), { jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools.length, 8);
});

test('routine creation validates input and persists structured activity', () => {
  const state = createInitialState();
  const added = callTool(state, 'create_routine', { title: 'Call Nani', memberId: 'maya', time: '18:00', repeat: 'Weekly' }, 1000);
  assert.equal(added.structuredContent.routine.memberName, 'Maya');
  assert.equal(state.routines[0].title, 'Call Nani');
  assert.equal(state.activity[0].type, 'routine_created');
  assert.equal(callTool(state, 'create_routine', { title: 'Bad time', memberId: 'maya', time: '26:90', repeat: 'Daily' }).isError, true);
});

test('caregiver alert requires a fresh confirmation and never sends externally', () => {
  const state = createInitialState(), pending = new Map();
  const preview = callTool(state, 'prepare_caregiver_alert', { routineId: 'morning-check', reason: 'No check-in yet' }, 10_000, pending).structuredContent;
  assert.match(preview.effect, /No SMS/);
  assert.equal(state.escalationLog.length, 0);
  const confirmed = callTool(state, 'confirm_caregiver_alert', { actionId: preview.actionId, confirmed: true }, 10_001, pending).structuredContent;
  assert.equal(confirmed.externalMessageSent, false);
  assert.equal(state.escalationLog.length, 1);
  assert.equal(callTool(state, 'confirm_caregiver_alert', { actionId: preview.actionId, confirmed: true }, 10_002, pending).isError, true);
});

test('check-in updates routine and activity without sharing', () => {
  const state = createInitialState();
  const logged = callTool(state, 'log_check_in', { routineId: 'morning-check', outcome: 'completed', note: 'Had a nice chat.' }, 20_000).structuredContent;
  assert.equal(logged.routine.status, 'completed');
  assert.equal(logged.externalMessageSent, false);
  assert.equal(state.activity[0].type, 'completed');
});

test('local state writes can be reloaded from disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'homecircle-'));
  const path = join(dir, 'state.json');
  try {
    const state = createInitialState();
    callTool(state, 'log_check_in', { routineId: 'morning-check', outcome: 'completed' }, 50_000);
    await saveState(state, path);
    const stored = await loadState(path);
    assert.equal(stored.routines.find((item) => item.id === 'morning-check').status, 'completed');
    assert.equal(stored.activity[0].type, 'completed');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
