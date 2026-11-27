async function api(path, body, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('That took too long. Try again.');
    throw new Error('Can’t reach the server. Try again.');
  } finally {
    clearTimeout(timer);
  }

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

export const saveLesson = (dayId, stepId, extra = {}) => api('/api/lesson', { dayId, stepId, ...extra }, 50000);

export const sendChat = (message) => api('/api/chat', { message });

export const resetPlan = () => api('/api/reset', {});

export const newCourse = () => api('/api/courses/new', {});

export const openCourse = (courseId) => api('/api/courses/open', { courseId });

export const leaveCourse = () => api('/api/courses/leave', {});

export const loadFeed = (refresh = false) => api('/api/feed', refresh ? { refresh: true } : {});

export const takeFeed = (feedId) => api('/api/feed/take', { feedId });

export const skipFeed = (feedId) => api('/api/feed/skip', { feedId });
