import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser, type AuthUser } from "../common/auth";
import { PrismaService } from "../common/prisma.service";
import { StatsService } from "./stats.service";

const int = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(
    private readonly stats: StatsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthUser) {
    return this.stats.summary(user);
  }

  @Get("trend")
  trend(@CurrentUser() user: AuthUser, @Query("months") months?: string) {
    return this.stats.trend(user, int(months, 6));
  }

  @Get("breakdown")
  breakdown(@CurrentUser() user: AuthUser, @Query("maxSlices") maxSlices?: string) {
    return this.stats.breakdown(user, Math.min(int(maxSlices, 5), 12));
  }

  @Get("budget-watchlist")
  watchlist(@CurrentUser() user: AuthUser, @Query("limit") limit?: string) {
    return this.stats.watchlist(user, int(limit, 4));
  }
}

@ApiTags("stats")
@Controller("stats")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  statistics(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.stats.statistics(user, { from, to });
  }

  @Get("compare")
  compare(@CurrentUser() user: AuthUser, @Query("a") a = "", @Query("b") b = "") {
    return this.stats.compare(user, a, b);
  }

  @Get("months")
  months(@CurrentUser() user: AuthUser) {
    return this.stats.availableMonths(user);
  }
}
