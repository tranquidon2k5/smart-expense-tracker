import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import type { WalletType } from "@shared/types";
import { CurrentUser, type AuthUser } from "../common/auth";
import { WalletsService } from "./wallets.service";

const MSG = { message: "Dữ liệu chưa hợp lệ." };

export class CreateWalletDto {
  @IsString(MSG) @MaxLength(50, { message: "Tên ví tối đa 50 ký tự." }) name: string;
  @IsIn(["cash", "bank", "ewallet"], MSG) type: WalletType;
  @IsOptional() @IsNumber({}, MSG) balance?: number;
}

export class UpdateWalletDto {
  @IsOptional() @IsString(MSG) @MaxLength(50, { message: "Tên ví tối đa 50 ký tự." }) name?: string;
  @IsOptional() @IsIn(["cash", "bank", "ewallet"], MSG) type?: WalletType;
}

export class TransferDto {
  @IsString(MSG) fromWalletId: string;
  @IsString(MSG) toWalletId: string;
  @IsNumber({}, MSG) amount: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, MSG) date: string;
  @IsOptional() @IsString(MSG) @MaxLength(100, { message: "Ghi chú tối đa 100 ký tự." }) note?: string;
}

@ApiTags("wallets")
@Controller()
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Get("wallets")
  list(@CurrentUser() user: AuthUser) {
    return this.wallets.list(user.id);
  }

  /** Ví kèm thu/chi tháng này */
  @Get("wallets/summary")
  summaries(@CurrentUser() user: AuthUser) {
    return this.wallets.summaries(user);
  }

  @Post("wallets")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWalletDto) {
    return this.wallets.create(user.id, dto);
  }

  @Patch("wallets/:id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateWalletDto) {
    return this.wallets.update(user.id, id, dto);
  }

  @Delete("wallets/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.wallets.remove(user.id, id);
  }

  @Get("transfers")
  transfers(@CurrentUser() user: AuthUser, @Query("walletId") walletId?: string, @Query("limit") limit?: string) {
    return this.wallets.transfers(user.id, walletId || undefined, Number(limit) || 20);
  }

  @Post("transfers")
  transfer(@CurrentUser() user: AuthUser, @Body() dto: TransferDto) {
    return this.wallets.transfer(user, { ...dto, note: dto.note ?? "" });
  }
}
