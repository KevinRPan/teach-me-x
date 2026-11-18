async function api(path, body) {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.error || 'Something went wrong. Try again.');
    error.status = response.status;
    throw error;
  }

  return data;
}

export const getState = () => api('/api/state');

export const createPathways = (profile) => api('/api/pathways', { profile });

export const createPlan = (pathwayIds) => api('/api/plan', { pathwayIds });

export const revisePlan = (feedback) => api('/api/plan/revise', { feedback });

export const confirmPlan = () => api('/api/plan/confirm', {});

export const toggleStep = (dayId, stepId) => api('/api/progress', { dayId, stepId });

export const sendChat = (message) => api('/api/chat', { message });

export const resetPlan = () => api('/api/reset', {});
