export function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

export function sendEmpty(res, status, headers = {}) {
  res.writeHead(status, headers);
  res.end();
}

export function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}
