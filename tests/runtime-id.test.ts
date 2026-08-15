import { describe, expect, it } from "vitest";

import { createRuntimeId } from "../lib/utils/runtime-id";

describe("createRuntimeId", () => {
  it("works when Hermes-style global crypto is unavailable", () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });

    try {
      const first = createRuntimeId();
      const second = createRuntimeId();
      expect(first).toBeTruthy();
      expect(second).toBeTruthy();
      expect(second).not.toBe(first);
    } finally {
      if (cryptoDescriptor) {
        Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
      } else {
        delete (globalThis as { crypto?: unknown }).crypto;
      }
    }
  });
});
