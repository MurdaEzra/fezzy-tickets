export function createTokenBucketStore({ capacity, refillPerSecond }) {
  const buckets = new Map();

  function readBucket(key, now) {
    const current = buckets.get(key) ?? {
      tokens: capacity,
      updatedAt: now,
    };

    const elapsedSeconds = Math.max(0, now - current.updatedAt) / 1000;
    const replenishedTokens = Math.min(
      capacity,
      current.tokens + elapsedSeconds * refillPerSecond,
    );

    return {
      tokens: replenishedTokens,
      updatedAt: now,
    };
  }

  return {
    take(key, now = Date.now()) {
      const bucket = readBucket(key, now);
      const allowed = bucket.tokens >= 1;
      const nextTokens = allowed ? bucket.tokens - 1 : bucket.tokens;

      buckets.set(key, {
        tokens: nextTokens,
        updatedAt: now,
      });

      return {
        allowed,
        remaining: Math.floor(Math.max(0, nextTokens)),
        retryAfterSeconds: allowed || refillPerSecond <= 0 ? 0 : Math.ceil((1 - nextTokens) / refillPerSecond),
      };
    },
  };
}
