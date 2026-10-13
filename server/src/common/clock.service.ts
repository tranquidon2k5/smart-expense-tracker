import { Injectable } from "@nestjs/common";
import { timeIn, todayIn } from "@shared/dates";
import { AppConfig } from "./config";

/**
 * "Bây giờ" của server. Mặc định là giờ thật; CLOCK_NOW (demo) hoặc `set()` (test) dời mốc
 * thời gian nhưng đồng hồ vẫn chạy tiếp từ mốc đó, nên job và test không phụ thuộc đồng hồ máy.
 */
@Injectable()
export class ClockService {
  private offsetMs = 0;

  constructor(config: AppConfig) {
    const fixed = config.get("CLOCK_NOW");
    if (fixed) this.set(new Date(fixed));
  }

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  set(at: Date): void {
    this.offsetMs = at.getTime() - Date.now();
  }

  /** Ngày hôm nay theo múi giờ người dùng ("yyyy-MM-dd") */
  today(timezone: string, at: Date = this.now()): string {
    return todayIn(timezone, at);
  }

  /** Giờ:phút hiện tại theo múi giờ người dùng */
  time(timezone: string, at: Date = this.now()): string {
    return timeIn(timezone, at);
  }
}
