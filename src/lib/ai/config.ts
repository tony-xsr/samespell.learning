import "server-only";
import { kvGet, kvSet } from "@/lib/kv";

export type AiProviderId = "anthropic" | "groq" | "gemini" | "openai" | "deepseek";

export const AI_PROVIDERS: { id: AiProviderId; label: string; defaultModel: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-opus-4-8" },
  { id: "groq", label: "Groq", defaultModel: "llama-3.3-70b-versatile" },
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  { id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-v4-flash" },
];

export interface AiConfig {
  activeProvider: AiProviderId;
  /** Provider dùng khi activeProvider lỗi (vd hết quota, timeout, lỗi mạng). Mặc định "deepseek"
   * vì nhanh và rẻ, phù hợp làm phương án dự phòng cho việc sinh từ vựng hàng loạt. */
  fallbackProvider: AiProviderId;
  keys: Partial<Record<AiProviderId, string>>;
  models: Partial<Record<AiProviderId, string>>;
}

const KV_KEY = "ai:config";

function defaultModels(): Record<AiProviderId, string> {
  return Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p.defaultModel])) as Record<
    AiProviderId,
    string
  >;
}

export async function getAiConfig(): Promise<AiConfig> {
  let stored: AiConfig | null = null;
  try {
    stored = await kvGet<AiConfig>(KV_KEY);
  } catch {
    // KV chưa cấu hình — dùng mặc định, chỉ dựa vào API key trong biến môi trường.
  }
  return {
    activeProvider: stored?.activeProvider ?? "anthropic",
    fallbackProvider: stored?.fallbackProvider ?? "deepseek",
    keys: stored?.keys ?? {},
    models: { ...defaultModels(), ...(stored?.models ?? {}) },
  };
}

export async function saveAiConfig(patch: Partial<AiConfig>): Promise<AiConfig> {
  const current = await getAiConfig();
  const next: AiConfig = {
    activeProvider: patch.activeProvider ?? current.activeProvider,
    fallbackProvider: patch.fallbackProvider ?? current.fallbackProvider,
    keys: { ...current.keys, ...(patch.keys ?? {}) },
    models: { ...current.models, ...(patch.models ?? {}) },
  };
  await kvSet(KV_KEY, next);
  return next;
}

const ENV_KEY_NAMES: Record<AiProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

export function resolveApiKey(provider: AiProviderId, config: AiConfig): string | undefined {
  return config.keys[provider] || process.env[ENV_KEY_NAMES[provider]];
}

export function hasApiKey(provider: AiProviderId, config: AiConfig): boolean {
  return Boolean(resolveApiKey(provider, config));
}

export function maskKey(key: string | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
