/**
 * What the image model costs (ROADMAP 3.1, K13): list prices of the Anthropic
 * API in USD per million tokens, read on 2026-10-04 from the Claude API
 * reference (cached table of 2026-09-25). The photo of a shelf is billed as
 * input tokens, so input and output tokens are all there is to price.
 *
 * **A model the table does not know has no cost, not a guessed one** (N12):
 * the view then says the cost is unknown for those tokens. A test checks that
 * every model `lib/recognize.ts` may call is listed here, so changing the
 * model without its price fails the suite (CLAUDE.md, "Analytics").
 */
export const PRICES_AS_OF = '2026-10-04';

export const MODEL_PRICES: Readonly<Record<string, { inputPerMTok: number; outputPerMTok: number }>> = {
  'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-opus-5-5': { inputPerMTok: 4, outputPerMTok: 20 },
  'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
};

/** Cost in USD of the given tokens on a model, or null when the model's price is not known. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
}
