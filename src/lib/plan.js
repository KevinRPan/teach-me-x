export function planProgress(plan) {
  const steps = plan?.days?.flatMap((day) => day.steps || []) ?? [];
  if (steps.length === 0) return 0;
  return steps.filter((step) => step.completed).length / steps.length;
}

export function currentDay(plan) {
  if (!plan?.days?.length) return null;
  return plan.days.find((day) => day.steps?.some((step) => !step.completed)) || plan.days[plan.days.length - 1];
}

export function isWeekComplete(plan) {
  return Boolean(plan?.days?.length) && plan.days.every((day) => day.steps.every((step) => step.completed));
}
