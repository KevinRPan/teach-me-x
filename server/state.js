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

export function stateFromRow(row) {
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
