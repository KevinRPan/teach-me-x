import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { emptyState, ownerIdOk, stateFromRow } from './state.js';

export { emptyState, ownerIdOk };

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
      return stateFromRow(readRow.get(id));
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
