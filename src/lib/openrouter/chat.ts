import { orJson } from "./client";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOpts {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** OpenAI-style response_format passthrough (e.g. json_schema). */
  responseFormat?: Record<string, unknown>;
  /** Per-user OpenRouter key; falls back to the server key when omitted. */
  apiKey?: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

/**
 * Single chat completion. Returns the assistant message content string.
 * Caller is responsible for parsing/validating structured output.
 */
export async function chatCompletion(opts: ChatCompletionOpts): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.responseFormat) body.response_format = opts.responseFormat;

  const json = await orJson<ChatCompletionResponse>(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { apiKey: opts.apiKey },
  );

  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(
      `OpenRouter chat returned no content${json.error?.message ? `: ${json.error.message}` : ""}`,
    );
  }
  return content;
}

/** Build a strict json_schema response_format for structured output. */
export function jsonSchemaFormat(
  name: string,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "json_schema",
    json_schema: { name, strict: true, schema },
  };
}
