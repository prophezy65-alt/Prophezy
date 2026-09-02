/**
 * lib/chat/router/router.service.ts
 *
 * Takes a classified intent + a plan step and actually invokes the right
 * module adapter. Distinguishes ModuleNotWiredError (expected, handled
 * gracefully — tells the user honestly) from any other adapter failure
 * (unexpected, surfaced as a real error).
 */

import { getModuleAdapter, WIRED_MODULES } from "./module-registry";
import { ModuleNotWiredError } from "../types/chat.types";
import type { ChatModuleId, ModuleInvocationParams, ModuleResult } from "../types/chat.types";

export async function invokeModule(module: ChatModuleId, params: ModuleInvocationParams): Promise<ModuleResult> {
  const adapter = getModuleAdapter(module);

  try {
    return await adapter(params);
  } catch (err) {
    if (err instanceof ModuleNotWiredError) {
      return {
        module,
        summary: `I'd normally handle this with ${humanizeModuleName(module)}, but that integration isn't finished on the backend yet — ${err.message}`,
      };
    }
    throw err;
  }
}

export function isModuleWired(module: ChatModuleId): boolean {
  return WIRED_MODULES.includes(module);
}

function humanizeModuleName(module: ChatModuleId): string {
  return module
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}
