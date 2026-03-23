import { Global, Module } from "@nestjs/common";
import { RequestRateLimiterService } from "./request-rate-limiter.service";
import { WorkflowExecutionLockService } from "./workflow-execution-lock.service";

@Global()
@Module({
  providers: [RequestRateLimiterService, WorkflowExecutionLockService],
  exports: [RequestRateLimiterService, WorkflowExecutionLockService]
})
export class CommonModule {}
