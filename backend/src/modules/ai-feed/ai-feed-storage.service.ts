import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { AiFeedSnapshot } from "./ai-feed.types";

const EMPTY_SNAPSHOT: AiFeedSnapshot = {
  generatedAt: "",
  itemCount: 0,
  sources: [],
  items: []
};

@Injectable()
export class AiFeedStorageService {
  private readonly storagePath = path.resolve(
    process.cwd(),
    process.env.AI_FEED_STORAGE_PATH?.trim() || "storage/ai-feed/items.json"
  );

  async readSnapshot(): Promise<AiFeedSnapshot> {
    try {
      const raw = await readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(raw) as AiFeedSnapshot;
      return {
        generatedAt: parsed.generatedAt ?? "",
        itemCount: parsed.itemCount ?? parsed.items?.length ?? 0,
        sources: parsed.sources ?? [],
        items: parsed.items ?? []
      };
    } catch {
      return EMPTY_SNAPSHOT;
    }
  }

  async writeSnapshot(snapshot: AiFeedSnapshot): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    await writeFile(this.storagePath, JSON.stringify(snapshot, null, 2), "utf8");
  }

  getStoragePath(): string {
    return this.storagePath;
  }
}
