import { Module } from "@nestjs/common";
import { AiFeedController } from "./ai-feed.controller";
import { AiFeedService } from "./ai-feed.service";
import { AiFeedStorageService } from "./ai-feed-storage.service";

@Module({
  controllers: [AiFeedController],
  providers: [AiFeedService, AiFeedStorageService],
  exports: [AiFeedService, AiFeedStorageService]
})
export class AiFeedModule {}
