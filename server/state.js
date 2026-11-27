export function emptyState() {
  return {
    profile: null,
    pathways: [],
    selectedPathways: [],
    plan: null,
    planStatus: null,
    hasRevised: false,
    messages: [],
    courses: [],
    feed: [],
    activeCourseId: null,
    pausedCourseId: null,
  };
}

export function pathwaysColumn(state) {
  const courses = state?.courses || [];
  const feed = state?.feed || [];
  const activeCourseId = state?.activeCourseId || null;
  const pausedCourseId = state?.pausedCourseId || null;
  if (!courses.length && !feed.length && !activeCourseId && !pausedCourseId) {
    return JSON.stringify(state?.pathways || []);
  }
  return JSON.stringify({
    pathways: state?.pathways || [],
    courses,
    feed,
    activeCourseId,
    pausedCourseId,
  });
}

function unpackPathways(value) {
  const parsed = parseJson(value, []);
  if (Array.isArray(parsed)) {
    return { pathways: parsed, courses: [], feed: [], activeCourseId: null, pausedCourseId: null };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { pathways: [], courses: [], feed: [], activeCourseId: null, pausedCourseId: null };
  }
  return {
    pathways: Array.isArray(parsed.pathways) ? parsed.pathways : [],
    courses: Array.isArray(parsed.courses) ? parsed.courses : [],
    feed: Array.isArray(parsed.feed) ? parsed.feed : [],
    activeCourseId: typeof parsed.activeCourseId === 'string' ? parsed.activeCourseId : null,
    pausedCourseId: typeof parsed.pausedCourseId === 'string' ? parsed.pausedCourseId : null,
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
  const library = unpackPathways(row.pathways_json);
  const selectedPathways = parseJson(row.selected_json, []);
  const plan = parseJson(row.plan_json, null);
  const messages = parseJson(row.messages_json, []);
  return {
    profile: profile && typeof profile === 'object' ? profile : null,
    pathways: library.pathways,
    selectedPathways: Array.isArray(selectedPathways) ? selectedPathways : [],
    plan: plan && typeof plan === 'object' ? plan : null,
    planStatus: row.plan_status || null,
    hasRevised: Boolean(row.has_revised),
    messages: Array.isArray(messages) ? messages : [],
    courses: library.courses,
    feed: library.feed,
    activeCourseId: library.activeCourseId,
    pausedCourseId: library.pausedCourseId,
  };
}
