function compilePath(pattern) {
  const names = [];
  const source = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:([A-Za-z0-9_]+)/g, (_match, name) => {
      names.push(name);
      return "([^/]+)";
    });

  return {
    matcher: new RegExp(`^${source}$`),
    names,
  };
}

export function createRouter() {
  const routes = [];

  function add(method, pattern, handler) {
    routes.push({
      handler,
      method,
      pattern,
      ...compilePath(pattern),
    });
  }

  return {
    get(pattern, handler) {
      add("GET", pattern, handler);
    },
    post(pattern, handler) {
      add("POST", pattern, handler);
    },
    async handle({ req, res, url, context }) {
      for (const route of routes) {
        if (route.method !== req.method) {
          continue;
        }

        const match = url.pathname.match(route.matcher);
        if (!match) {
          continue;
        }

        const params = Object.fromEntries(
          route.names.map((name, index) => [name, decodeURIComponent(match[index + 1])]),
        );

        await route.handler({
          ...context,
          params,
          req,
          res,
          url,
        });
        return true;
      }

      return false;
    },
  };
}
