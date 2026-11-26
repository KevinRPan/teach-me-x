export function serveShell() {
  return new Response('The phone app has not been attached to this worker yet.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
