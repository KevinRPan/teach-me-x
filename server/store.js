import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
create table if not exists sessions (
  id text primary key,
  created_at text not null
);
create table if not exists learner_state (
  session_id text primary key,
  profile_json text,
  pathways_json text,
  selected_json text,
  plan_json text,
  plan_status text,
  has_revised integer not null default 0,
  messages_json text not null default '[]',
  updated_at text not null
);
`;

export function emptyState() {
  return {
    profile: null,
    pathways: [],
    selectedPathways: [],
    plan: null,
    planStatus: null,
    hasRevised: false,
    messages: [],
  };
}

export function ownerIdOk(id) {
  if (typeof id !== 'string' || id.length < 1 || id.length > 200) return false;
  for (let index = 0; index < id.length; index += 1) {
    if (id.charCodeAt(index) <= 32) return false;
  }
  return true;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function createStore(dbPath) {
  mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('pragma journal_mode = WAL');
  db.exec('pragma foreign_keys = ON');
  db.exec(SCHEMA);

  const insertSession = db.prepare('insert into sessions (id, created_at) values (?, ?)');
  const insertState = db.prepare(
    "insert into learner_state (session_id, messages_json, updated_at) values (?, '[]', ?)",
  );
  const findSession = db.prepare('select id from sessions where id = ?');
  const readRow = db.prepare('select * from learner_state where session_id = ?');
  const writeRow = db.prepare(`
    update learner_state
    set profile_json = ?,
        pathways_json = ?,
        selected_json = ?,
        plan_json = ?,
        plan_status = ?,
        has_revised = ?,
        messages_json = ?,
        updated_at = ?
    where session_id = ?
  `);

  return {
    createSession() {
      const id = randomBytes(24).toString('hex');
      const now = new Date().toISOString();
      insertSession.run(id, now);
      insertState.run(id, now);
      return id;
    },
    hasSession(id) {
      return typeof id === 'string' && /^[a-f0-9]{48}$/.test(id) && Boolean(findSession.get(id));
    },
    ensure(id) {
      if (!ownerIdOk(id)) {
        const error = new Error('That account cannot be saved.');
        error.status = 400;
        throw error;
      }
      if (!findSession.get(id)) {
        const now = new Date().toISOString();
        insertSession.run(id, now);
        insertState.run(id, now);
      }
    },
    read(id) {
      const row = readRow.get(id);
      if (!row) return emptyState();
      const profile = parseJson(row.profile_json, null);
      const pathways = parseJson(row.pathways_json, []);
      const selectedPathways = parseJson(row.selected_json, []);
      const plan = parseJson(row.plan_json, null);
      const messages = parseJson(row.messages_json, []);
      return {
        profile: profile && typeof profile === 'object' ? profile : null,
        pathways: Array.isArray(pathways) ? pathways : [],
        selectedPathways: Array.isArray(selectedPathways) ? selectedPathways : [],
        plan: plan && typeof plan === 'object' ? plan : null,
        planStatus: row.plan_status || null,
        hasRevised: Boolean(row.has_revised),
        messages: Array.isArray(messages) ? messages : [],
      };
    },
    write(id, state) {
      writeRow.run(
        state.profile ? JSON.stringify(state.profile) : null,
        JSON.stringify(state.pathways || []),
        JSON.stringify(state.selectedPathways || []),
        state.plan ? JSON.stringify(state.plan) : null,
        state.planStatus || null,
        state.hasRevised ? 1 : 0,
        JSON.stringify(state.messages || []),
        new Date().toISOString(),
        id,
      );
    },
    close() {
      db.close();
    },
  };
}
