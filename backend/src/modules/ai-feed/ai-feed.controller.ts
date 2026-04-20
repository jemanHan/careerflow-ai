import { Controller, Get } from "@nestjs/common";
import { AiFeedService } from "./ai-feed.service";

@Controller("ai-feed")
export class AiFeedController {
  constructor(private readonly aiFeedService: AiFeedService) {}

  @Get()
  getSnapshot() {
    return this.aiFeedService.getSnapshot();
  }
}
