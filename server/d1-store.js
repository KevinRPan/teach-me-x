import { ownerIdOk, stateFromRow } from './state.js';

const SESSION = /^[a-f0-9]{48}$/;

function sessionId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function now() {
  return new Date().toISOString();
}

export function createD1Store(db) {
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

  async function openSession(id) {
    const stamp = now();
    await insertSession.bind(id, stamp).run();
    await insertState.bind(id, stamp).run();
  }

  return {
    async createSession() {
      const id = sessionId();
      await openSession(id);
      return id;
    },
    async hasSession(id) {
      if (typeof id !== 'string' || !SESSION.test(id)) return false;
      const row = await findSession.bind(id).first();
      return Boolean(row);
    },
    async ensure(id) {
      if (!ownerIdOk(id)) {
        const error = new Error('That account cannot be saved.');
        error.status = 400;
        throw error;
      }
      const existing = await findSession.bind(id).first();
      if (!existing) await openSession(id);
    },
    async read(id) {
      return stateFromRow(await readRow.bind(id).first());
    },
    async write(id, state) {
      await writeRow.bind(
        state.profile ? JSON.stringify(state.profile) : null,
        JSON.stringify(state.pathways || []),
        JSON.stringify(state.selectedPathways || []),
        state.plan ? JSON.stringify(state.plan) : null,
        state.planStatus || null,
        state.hasRevised ? 1 : 0,
        JSON.stringify(state.messages || []),
        now(),
        id,
      ).run();
    },
  };
}
