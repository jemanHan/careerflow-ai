import { Injectable } from "@nestjs/common";
import { AiFeedCollector } from "./ai-feed.collector";
import { AiFeedStorageService } from "./ai-feed-storage.service";
import { AiFeedSnapshot } from "./ai-feed.types";

@Injectable()
export class AiFeedService {
  constructor(private readonly aiFeedStorageService: AiFeedStorageService) {}

  async getSnapshot(): Promise<AiFeedSnapshot> {
    return this.aiFeedStorageService.readSnapshot();
  }

  async collectAndStore(): Promise<AiFeedSnapshot> {
    const collector = new AiFeedCollector({
      geminiApiKey: process.env.GEMINI_API_KEY,
      geminiModel: process.env.AI_FEED_GEMINI_MODEL || process.env.GEMINI_DEFAULT_MODEL || "gemini-2.5-flash-lite"
    });

    const snapshot = await collector.collectSnapshot();
    await this.aiFeedStorageService.writeSnapshot(snapshot);
    return snapshot;
  }
}
