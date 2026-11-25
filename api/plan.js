import { handle } from '../server/published-app.js';

export function POST(request) {
  return handle(request);
}
