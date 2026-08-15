let runtimeIdCounter = 0;

/**
 * Creates identifiers for in-memory conversation operations and messages.
 * Hermes does not expose the Web Crypto global expected by uuid v14, so this
 * deliberately avoids an additional native dependency.
 */
export function createRuntimeId(): string {
  runtimeIdCounter = (runtimeIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  const timestamp = Date.now().toString(36);
  const counter = runtimeIdCounter.toString(36);
  const random = Math.random().toString(36).slice(2, 12);
  return `${timestamp}-${counter}-${random}`;
}
