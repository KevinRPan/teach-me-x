import { sql } from './db.js';
import { emptyState, ownerIdOk } from './store.js';

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToState(row) {
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
}

export function createPgStore(query = sql) {
  return {
    async ensure(id) {
      if (!ownerIdOk(id)) {
        const error = new Error('That account cannot be saved.');
        error.status = 400;
        throw error;
      }
      await query(
        'insert into learner_state (owner) values ($1) on conflict (owner) do nothing',
        [id],
      );
    },
    async read(id) {
      const rows = await query('select * from learner_state where owner = $1', [id]);
      return rowToState(rows[0]);
    },
    async write(id, state) {
      await query(
        `update learner_state
         set profile_json = $2,
             pathways_json = $3,
             selected_json = $4,
             plan_json = $5,
             plan_status = $6,
             has_revised = $7,
             messages_json = $8,
             updated_at = now()
         where owner = $1`,
        [
          id,
          state.profile ? JSON.stringify(state.profile) : null,
          JSON.stringify(state.pathways || []),
          JSON.stringify(state.selectedPathways || []),
          state.plan ? JSON.stringify(state.plan) : null,
          state.planStatus || null,
          Boolean(state.hasRevised),
          JSON.stringify(state.messages || []),
        ],
      );
    },
  };
}
