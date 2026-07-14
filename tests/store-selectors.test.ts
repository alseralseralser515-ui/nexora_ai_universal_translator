import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("conversation store selectors", () => {
  it("does not use object-returning Zustand selectors for composed UI hooks", () => {
    const source = readFileSync("lib/services/conversation/store.ts", "utf8");

    expect(source).not.toContain("useConversationStore((state: ConversationStoreType) => ({");
  });
});
