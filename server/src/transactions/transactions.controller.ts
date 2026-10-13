import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import type { Response } from "express";
import type { TransactionFilter, TransactionView } from "@shared/types";
import { CurrentUser, type AuthUser } from "../common/auth";
import { badRequest } from "../common/errors";
import { PrismaService } from "../common/prisma.service";
import { TransactionsService } from "./transactions.service";

const MSG = { message: "Dữ liệu chưa hợp lệ." };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const list = (v: unknown) =>
  typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? (v as string[]) : undefined;

export class TransactionQueryDto {
  @IsOptional() @Matches(ISO_DATE, MSG) from?: string;
  @IsOptional() @Matches(ISO_DATE, MSG) to?: string;
  @IsOptional() @IsString(MSG) walletIds?: string;
  @IsOptional() @IsString(MSG) categoryIds?: string;
  @IsOptional() @Type(() => Number) @IsNumber({}, MSG) minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber({}, MSG) maxAmount?: number;
  @IsOptional() @IsIn(["income", "expense"], MSG) type?: "income" | "expense";
  @IsOptional() @IsIn(["confirmed", "pending"], MSG) status?: "confirmed" | "pending";
  @IsOptional() @IsString(MSG) @MaxLength(100, MSG) query?: string;
  @IsOptional() @Type(() => Number) @IsInt(MSG) @Min(1, MSG) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt(MSG) @Min(0, MSG) cursor?: number;
}

export class CreateTransactionDto {
  @IsString(MSG) walletId: string;
  @IsString(MSG) categoryId: string;
  @IsNumber({}, MSG) amount: number;
  @Matches(ISO_DATE, MSG) date: string;
  @IsString(MSG) @MaxLength(255, MSG) description: string;
}

export class TransactionPatchDto {
  @IsOptional() @IsNumber({}, MSG) amount?: number;
  @IsOptional() @IsIn(["income", "expense"], MSG) type?: "income" | "expense";
  @IsOptional() @IsString(MSG) categoryId?: string;
  @IsOptional() @IsString(MSG) walletId?: string;
  @IsOptional() @Matches(ISO_DATE, MSG) date?: string;
  @IsOptional() @IsString(MSG) @MaxLength(255, MSG) description?: string;
}

class BulkPatchDto {
  @IsOptional() @IsString(MSG) categoryId?: string;
  @IsOptional() @IsString(MSG) walletId?: string;
}

export class BulkUpdateDto {
  @IsArray(MSG) @ArrayMaxSize(1000, MSG) @IsString({ ...MSG, each: true }) ids: string[];
  @ValidateNested() @Type(() => BulkPatchDto) patch: BulkPatchDto;
}

export class IdsDto {
  @IsArray(MSG) @ArrayMaxSize(1000, MSG) @IsString({ ...MSG, each: true }) ids: string[];
}

export class ReviewDto {
  @IsOptional() @IsString(MSG) categoryId?: string;
}

export class RulePreviewDto {
  @IsString(MSG) @MaxLength(60, MSG) keyword: string;
  @IsString(MSG) categoryId: string;
  @IsOptional() @IsString(MSG) excludeId?: string;
}

export class CreateRuleDto {
  @IsString(MSG) @MaxLength(60, MSG) keyword: string;
  @IsString(MSG) categoryId: string;
  @IsOptional() @IsBoolean(MSG) applyToPending?: boolean;
}

@ApiTags("transactions")
@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() q: TransactionQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransactionView[]> {
    const filter: TransactionFilter = {
      from: q.from,
      to: q.to,
      walletIds: list(q.walletIds),
      categoryIds: list(q.categoryIds),
      minAmount: q.minAmount,
      maxAmount: q.maxAmount,
      type: q.type,
      status: q.status,
      query: q.query,
    };
    const page = await this.transactions.list(user.id, filter, { limit: q.limit, cursor: q.cursor });
    res.setHeader("X-Total-Count", String(page.total));
    if (page.nextCursor != null) res.setHeader("X-Next-Cursor", String(page.nextCursor));
    return page.items;
  }

  @Get("recent")
  recent(@CurrentUser() user: AuthUser, @Query("limit") limit?: string) {
    return this.transactions.recent(user.id, Number(limit) || 8);
  }

  @Get("search")
  search(@CurrentUser() user: AuthUser, @Query("q") q = "", @Query("limit") limit?: string) {
    return this.transactions.search(user.id, q, Number(limit) || 8);
  }

  @Get("pending")
  pending(@CurrentUser() user: AuthUser) {
    return this.transactions.pending(user.id);
  }

  @Get("pending/count")
  async pendingCount(@CurrentUser() user: AuthUser) {
    return { count: await this.transactions.pendingCount(this.prisma, user.id) };
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.transactions.get(user.id, id);
  }

  /** Thêm bằng form (F04) */
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    if (dto.date > this.transactions.today(user)) throw badRequest("Ngày giao dịch không được sau hôm nay.", "date");
    const { transaction, activity } = await this.prisma.$transaction((db) =>
      this.transactions.createWithRewards(db, user, {
        ...dto,
        source: "form",
        aiConfidence: null,
        status: "confirmed",
      }),
    );
    return { transaction, xpGained: activity.xp, xpLimitReached: activity.limitReached };
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: TransactionPatchDto) {
    return this.transactions.update(user, id, dto);
  }

  @Post("bulk-update")
  @HttpCode(200)
  bulkUpdate(@CurrentUser() user: AuthUser, @Body() dto: BulkUpdateDto) {
    return this.transactions.bulkUpdate(user, dto.ids, dto.patch);
  }

  @Post("bulk-delete")
  @HttpCode(200)
  bulkDelete(@CurrentUser() user: AuthUser, @Body() dto: IdsDto) {
    return this.transactions.remove(user, dto.ids);
  }

  @Post(":id/review")
  @HttpCode(200)
  review(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ReviewDto) {
    return this.transactions.review(user, id, dto.categoryId);
  }
}

@ApiTags("rules")
@Controller("rules")
export class RulesController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.transactions.listRules(user.id);
  }

  @Post("preview")
  @HttpCode(200)
  preview(@CurrentUser() user: AuthUser, @Body() dto: RulePreviewDto) {
    return this.transactions.previewRule(user.id, dto.keyword, dto.categoryId, dto.excludeId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRuleDto) {
    return this.transactions.createRule(user, dto.keyword, dto.categoryId, dto.applyToPending ?? false);
  }
}
