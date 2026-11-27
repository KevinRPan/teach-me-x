import { sql } from './db.js';
import { ownerIdOk, pathwaysColumn, stateFromRow } from './state.js';

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
      return stateFromRow(rows[0]);
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
          pathwaysColumn(state),
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
