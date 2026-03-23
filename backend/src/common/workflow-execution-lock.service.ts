import { ConflictException, Injectable } from "@nestjs/common";

@Injectable()
export class WorkflowExecutionLockService {
  private readonly runningKeys = new Set<string>();

  acquireOrThrow(lockKey: string): void {
    if (this.runningKeys.has(lockKey)) {
      throw new ConflictException(`Workflow stage is already running: ${lockKey}`);
    }
    this.runningKeys.add(lockKey);
  }

  release(lockKey: string): void {
    this.runningKeys.delete(lockKey);
  }
}
