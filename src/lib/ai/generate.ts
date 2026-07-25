import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { z } from "zod";
import { getAiConfig, resolveApiKey, type AiProviderId } from "@/lib/ai/config";

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

async function generateWithAnthropic<T extends z.ZodTypeAny>(
  schema: T,
  prompt: string,
  apiKey: string,
  model: string,
): Promise<z.infer<T>> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.parse({
    model,
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  if (!response.parsed_output) throw new Error("Anthropic không trả về dữ liệu hợp lệ.");
  return response.parsed_output;
}

async function generateWithOpenAiCompatible<T extends z.ZodTypeAny>(
  schema: T,
  prompt: string,
  apiKey: string,
  model: string,
  baseURL: string | undefined,
  providerLabel: string,
): Promise<z.infer<T>> {
  const client = new OpenAI({ apiKey, baseURL });
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "Bạn chỉ trả lời bằng một JSON object hợp lệ duy nhất, không thêm giải thích, không dùng markdown code fence.",
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error(`${providerLabel} không trả về nội dung.`);
  return schema.parse(JSON.parse(stripCodeFence(raw)));
}

async function generateWithGemini<T extends z.ZodTypeAny>(
  schema: T,
  prompt: string,
  apiKey: string,
  model: string,
): Promise<z.infer<T>> {
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({
    model,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await genModel.generateContent(prompt);
  const raw = result.response.text();
  return schema.parse(JSON.parse(stripCodeFence(raw)));
}

async function dispatchProvider<T extends z.ZodTypeAny>(
  provider: AiProviderId,
  schema: T,
  prompt: string,
  apiKey: string,
  model: string,
): Promise<z.infer<T>> {
  switch (provider) {
    case "anthropic":
      return generateWithAnthropic(schema, prompt, apiKey, model);
    case "openai":
      return generateWithOpenAiCompatible(schema, prompt, apiKey, model, undefined, "OpenAI");
    case "groq":
      return generateWithOpenAiCompatible(
        schema,
        prompt,
        apiKey,
        model,
        "https://api.groq.com/openai/v1",
        "Groq",
      );
    case "deepseek":
      return generateWithOpenAiCompatible(
        schema,
        prompt,
        apiKey,
        model,
        "https://api.deepseek.com/v1",
        "DeepSeek",
      );
    case "gemini":
      return generateWithGemini(schema, prompt, apiKey, model);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Provider không được hỗ trợ: ${exhaustive}`);
    }
  }
}

export async function generateStructured<T extends z.ZodTypeAny>(
  schema: T,
  prompt: string,
): Promise<z.infer<T>> {
  const config = await getAiConfig();
  const provider = config.activeProvider;
  const apiKey = resolveApiKey(provider, config);
  if (!apiKey) {
    throw new Error(`Chưa cấu hình API key cho ${provider}. Vào /admin để thêm.`);
  }
  const model = config.models[provider]!;

  try {
    return await dispatchProvider(provider, schema, prompt, apiKey, model);
  } catch (primaryError) {
    const fallback = config.fallbackProvider;
    const fallbackKey = fallback !== provider ? resolveApiKey(fallback, config) : undefined;
    if (!fallbackKey) throw primaryError;

    const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
    console.warn(
      `[ai/generate] Provider "${provider}" lỗi (${primaryMessage}), thử lại với fallback "${fallback}".`,
    );
    try {
      return await dispatchProvider(fallback, schema, prompt, fallbackKey, config.models[fallback]!);
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Provider chính "${provider}" lỗi: ${primaryMessage}. Fallback "${fallback}" cũng lỗi: ${fallbackMessage}`,
      );
    }
  }
}

export type { AiProviderId };
