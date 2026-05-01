import { describe, expect, it } from "vitest";
import { createTokenBucketStore } from "./rate-limit.js";

describe("createTokenBucketStore", () => {
  it("blocks requests after the bucket is exhausted", () => {
    const store = createTokenBucketStore({ capacity: 2, refillPerSecond: 0 });

    expect(store.take("ip:1", 0).allowed).toBe(true);
    expect(store.take("ip:1", 0).allowed).toBe(true);
    expect(store.take("ip:1", 0).allowed).toBe(false);
  });

  it("refills tokens over time", () => {
    const store = createTokenBucketStore({ capacity: 2, refillPerSecond: 1 });

    store.take("ip:1", 0);
    store.take("ip:1", 0);

    expect(store.take("ip:1", 500).allowed).toBe(false);
    expect(store.take("ip:1", 1000).allowed).toBe(true);
  });
});
