import { getIdentity } from '../cursor/identity.js';

export async function viewerOwner(request) {
  const identity = await getIdentity(request);
  if (!identity.verified || typeof identity.sub !== 'string' || identity.sub === '') return null;
  const stage = identity.stage === 'production' || identity.stage === 'preview' ? identity.stage : 'local';
  return `${stage}:${identity.sub}`;
}
