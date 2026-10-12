import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInitialState, callTool, handleRpc, TOOL_DEFINITIONS, loadState, saveState } from '../server.mjs';

test('MCP advertises the target protocol and advanced tool catalog', () => {
  const init = handleRpc(createInitialState(), { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
  assert.equal(init.result.protocolVersion, '2025-11-25');
  assert.equal(TOOL_DEFINITIONS.length, 13);
  assert.equal(handleRpc(createInitialState(), { jsonrpc: '2.0', id: 2, method: 'tools/list' }).result.tools.length, 13);
});

test('advanced routine lifecycle supports priority, pause, filters, and archive history', () => {
  const state = createInitialState();
  const created = callTool(state, 'create_routine', { title: 'Library visit', memberId: 'maya', time: '17:15', repeat: 'Weekly', priority: 'high' }, 1000).structuredContent.routine;
  assert.equal(created.priority, 'high');
  assert.equal(callTool(state, 'update_routine', { routineId: created.id, status: 'paused', note: 'Paused for a week' }, 2000).structuredContent.routine.status, 'paused');
  assert.equal(callTool(state, 'list_routines', { status: 'paused' }).structuredContent.count, 1);
  assert.equal(callTool(state, 'archive_routine', { routineId: created.id }, 3000).structuredContent.ok, true);
  assert.equal(callTool(state, 'list_routines', {}).structuredContent.routines.some((item) => item.id === created.id), false);
  assert.equal(callTool(state, 'list_routines', { includeArchived: true }).structuredContent.routines.some((item) => item.id === created.id), true);
});

test('member management, household preferences, insights, and export stay local', () => {
  const state = createInitialState();
  const member = callTool(state, 'add_family_member', { name: 'Priya Kumar', role: 'Friend' }, 1000).structuredContent.member;
  assert.equal(member.initials, 'PK');
  const preferences = callTool(state, 'update_family_preference', { quietStart: '20:30', quietEnd: '06:30', followUpMinutes: 60, weekStartsOn: 'Sunday' }, 2000).structuredContent.preferences;
  assert.equal(preferences.followUpMinutes, 60);
  assert.equal(preferences.weekStartsOn, 'Sunday');
  assert.equal(callTool(state, 'update_family_preference', { followUpMinutes: 400 }).isError, true);
  const insights = callTool(state, 'get_insights').structuredContent;
  assert.equal(insights.activeRoutines, 3);
  assert.equal(insights.byMember.some((item) => item.member === 'Priya Kumar'), true);
  const exported = callTool(state, 'export_household_data').structuredContent;
  assert.equal(exported.format, 'homecircle-household-v1');
  assert.equal(exported.data.members.length, 4);
  assert.equal(exported.data.preferences.quietHours.start, '20:30');
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
