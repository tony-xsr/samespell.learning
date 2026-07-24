import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AI_PROVIDERS,
  getAiConfig,
  saveAiConfig,
  maskKey,
  hasApiKey,
  type AiProviderId,
} from "@/lib/ai/config";

const PROVIDER_IDS = AI_PROVIDERS.map((p) => p.id) as [AiProviderId, ...AiProviderId[]];
const PROVIDER_ID_SET = new Set<string>(PROVIDER_IDS);

// z.record with an enum key type requires every enum member to be present (a full
// mapping), which breaks "just update one provider's model". Use a plain string key
// and filter to known provider ids ourselves instead.
const PatchSchema = z.object({
  activeProvider: z.enum(PROVIDER_IDS).optional(),
  keys: z.record(z.string(), z.string()).optional(),
  models: z.record(z.string(), z.string()).optional(),
});

function pickKnownProviders(
  record: Record<string, string> | undefined,
): Partial<Record<AiProviderId, string>> | undefined {
  if (!record) return undefined;
  return Object.fromEntries(
    Object.entries(record).filter(([k]) => PROVIDER_ID_SET.has(k)),
  ) as Partial<Record<AiProviderId, string>>;
}

export async function GET() {
  const config = await getAiConfig();
  return NextResponse.json({
    providers: AI_PROVIDERS,
    activeProvider: config.activeProvider,
    models: config.models,
    maskedKeys: Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, maskKey(config.keys[p.id])])),
    hasKey: Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, hasApiKey(p.id, config)])),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const patch = parsed.data;
  // Bỏ qua key rỗng — người dùng để trống nghĩa là "không đổi".
  const knownKeys = pickKnownProviders(patch.keys);
  const keys = knownKeys
    ? (Object.fromEntries(
        Object.entries(knownKeys).filter(([, v]) => v.trim().length > 0),
      ) as Partial<Record<AiProviderId, string>>)
    : undefined;
  const models = pickKnownProviders(patch.models);

  try {
    const updated = await saveAiConfig({ activeProvider: patch.activeProvider, keys, models });
    return NextResponse.json({ ok: true, activeProvider: updated.activeProvider });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được cấu hình." },
      { status: 500 },
    );
  }
}
