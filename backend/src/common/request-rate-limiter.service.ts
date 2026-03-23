import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

type Bucket = {
  windowStartedAt: number;
  count: number;
};

@Injectable()
export class RequestRateLimiterService {
  private readonly buckets = new Map<string, Bucket>();

  checkOrThrow(params: { key: string; maxInWindow: number; windowMs: number }): void {
    const now = Date.now();
    const existing = this.buckets.get(params.key);

    if (!existing || now - existing.windowStartedAt > params.windowMs) {
      this.buckets.set(params.key, { windowStartedAt: now, count: 1 });
      return;
    }

    if (existing.count >= params.maxInWindow) {
      throw new HttpException("Rate limit exceeded for AI workflow route.", HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
    this.buckets.set(params.key, existing);
  }
}
