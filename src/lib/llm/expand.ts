import { chatCompletion, jsonSchemaFormat } from "@/lib/openrouter/chat";
import type { ChatMessage } from "@/lib/openrouter/chat";
import { scriptJsonSchema, scriptOutputSchema, type ScriptOutput } from "./adSchema";
import {
  buildRepairPrompt,
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
  type BriefInput,
} from "./prompts";
import type { ZodType } from "zod";

function stripFences(s: string): string {
  const trimmed = s.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fence ? fence[1] : trimmed;
}

function tryParse<T>(
  raw: string,
  schema: ZodType<T>,
): { ok: true; data: T } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, error: "response was not valid JSON" };
  }
  const r = schema.safeParse(json);
  if (!r.success) {
    return {
      ok: false,
      error: r.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, data: r.data };
}

/**
 * One structured LLM call with a single repair retry on schema-validation
 * failure.
 */
async function runStructured<T>(opts: {
  model: string;
  schemaName: string;
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: ZodType<T>;
  apiKey?: string;
}): Promise<T> {
  const messages: ChatMessage[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];
  const responseFormat = jsonSchemaFormat(opts.schemaName, opts.jsonSchema);

  let raw = await chatCompletion({
    model: opts.model,
    messages,
    responseFormat,
    temperature: 0.8,
    maxTokens: 4000,
    apiKey: opts.apiKey,
  });
  let parsed = tryParse(raw, opts.zodSchema);

  if (!parsed.ok) {
    messages.push({ role: "assistant", content: raw });
    messages.push({ role: "user", content: buildRepairPrompt(parsed.error) });
    raw = await chatCompletion({
      model: opts.model,
      messages,
      responseFormat,
      temperature: 0.3,
      maxTokens: 4000,
      apiKey: opts.apiKey,
    });
    parsed = tryParse(raw, opts.zodSchema);
    if (!parsed.ok) {
      throw new Error(
        `LLM output failed schema validation after repair: ${parsed.error}`,
      );
    }
  }
  return parsed.data;
}

/** Generate the script + voiceover narration. Audio track only. */
export async function generateScript(
  model: string,
  brief: BriefInput,
  context?: { concept?: string | null },
  apiKey?: string,
): Promise<ScriptOutput> {
  return runStructured({
    model,
    schemaName: "ad_script",
    system: buildScriptSystemPrompt(),
    user: buildScriptUserPrompt(brief, context),
    jsonSchema: scriptJsonSchema,
    zodSchema: scriptOutputSchema,
    apiKey,
  });
}
