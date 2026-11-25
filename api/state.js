import { handle } from '../server/published-app.js';

export function GET(request) {
  return handle(request);
}

export function POST(request) {
  return handle(request);
}
