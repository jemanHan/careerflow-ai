import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { Logger } from "@nestjs/common";
import { AiFeedCollector } from "../modules/ai-feed/ai-feed.collector";
import { AiFeedStorageService } from "../modules/ai-feed/ai-feed-storage.service";

function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function run(): Promise<void> {
  loadDotEnv();
  const logger = new Logger("AiFeedCollectorCli");
  const storage = new AiFeedStorageService();
  const existingSnapshot = await storage.readSnapshot();
  const collector = new AiFeedCollector({
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.AI_FEED_GEMINI_MODEL || process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash-lite"
  });

  const previousCount = existingSnapshot.itemCount ?? existingSnapshot.items?.length ?? 0;
  const snapshot = await collector.collectSnapshot(existingSnapshot);
  await storage.writeSnapshot(snapshot);
  const newItems = Math.max(snapshot.itemCount - previousCount, 0);

  logger.log(
    `AI feed snapshot saved: generatedAt=${snapshot.generatedAt}, itemCount=${snapshot.itemCount}, newItems=${newItems}, storagePath=${storage.getStoragePath()}`
  );
}

void run().catch((error: unknown) => {
  const logger = new Logger("AiFeedCollectorCli");
  logger.error("AI feed collection failed.", error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
