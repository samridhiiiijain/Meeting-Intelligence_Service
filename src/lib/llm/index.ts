import { GeminiProvider } from './gemini';
import type { LLMProvider } from './provider';

/**
 * LLM provider factory (lazy singleton).
 *
 * Instantiated on first use so a missing GEMINI_API_KEY only fails the analyze
 * endpoint — not the whole server boot. Swap the provider here to change vendors.
 */
let provider: LLMProvider | undefined;

export function getLLMProvider(): LLMProvider {
  if (!provider) {
    provider = new GeminiProvider();
  }
  return provider;
}

/** Test seam: inject a fake provider. */
export function setLLMProvider(p: LLMProvider): void {
  provider = p;
}

export type { LLMProvider } from './provider';
