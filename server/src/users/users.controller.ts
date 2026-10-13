import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import type { Response } from "express";
import { CurrentUser, type AuthUser } from "../common/auth";
import { GamificationService } from "../gamification/gamification.service";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "./users.service";

const MSG = { message: "Dữ liệu chưa hợp lệ." };

export class ProfileDto {
  @IsString(MSG) @MaxLength(80, { message: "Họ tên tối đa 80 ký tự" }) fullName: string;
  @IsString(MSG) @MaxLength(254, MSG) email: string;
}

export class PreferencesDto {
  @IsString(MSG) currency: string;
  @IsString(MSG) timezone: string;
}

export class ReminderDto {
  @IsBoolean(MSG) enabled: boolean;
  @IsString(MSG) time: string;
  @IsBoolean(MSG) email: boolean;
}

export class DeleteDataDto {
  @IsString(MSG) @MaxLength(40, MSG) confirmation: string;
}

@ApiTags("me")
@Controller("me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @Get("settings")
  settings(@CurrentUser() user: AuthUser) {
    return this.users.settings(user.id);
  }

  @Patch("profile")
  profile(@CurrentUser() user: AuthUser, @Body() dto: ProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch("preferences")
  @HttpCode(204)
  preferences(@CurrentUser() user: AuthUser, @Body() dto: PreferencesDto) {
    return this.users.updatePreferences(user.id, dto);
  }

  @Patch("reminder")
  reminder(@CurrentUser() user: AuthUser, @Body() dto: ReminderDto) {
    return this.users.updateReminder(user.id, dto);
  }

  /** Xuất toàn bộ dữ liệu: ?format=json (mặc định) hoặc csv (giao dịch, mở bằng Excel) */
  @Get("export")
  async export(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response, @Query("format") format?: string) {
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="so-tien-giao-dich.csv"');
      return this.users.exportCsv(user.id);
    }
    return this.users.exportAll(user.id);
  }

  @Delete("data")
  @HttpCode(204)
  deleteData(@CurrentUser() user: AuthUser, @Body() dto: DeleteDataDto) {
    return this.users.deleteAllData(user.id, dto.confirmation);
  }
}

@ApiTags("gamification")
@Controller("gamification")
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get("status")
  status(@CurrentUser() user: AuthUser) {
    return this.gamification.status(user.id, user.timezone);
  }

  @Get("missions")
  missions(@CurrentUser() user: AuthUser, @Query("period") period?: string) {
    const p = period === "weekly" ? "weekly" : "daily";
    return this.gamification.missionsFor(user.id, user.timezone, p);
  }

  @Get("achievements")
  achievements(@CurrentUser() user: AuthUser) {
    return this.gamification.achievements(user.id, user.timezone);
  }

  @Get("motivation")
  async motivation(@CurrentUser() user: AuthUser) {
    return { message: await this.gamification.motivation(user.id, user.timezone, user.fullName) };
  }

  /** "Hôm nay không chi tiêu" — vẫn giữ chuỗi ngày (PRD §6.2) */
  @Post("no-spend-day")
  noSpendDay(@CurrentUser() user: AuthUser) {
    return this.gamification.markNoSpendDay(user.id, user.timezone);
  }
}

export class MarkReadDto {
  @IsOptional() @IsBoolean(MSG) isRead?: boolean;
}

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("type") type?: string) {
    return this.notifications.list(user.id, type);
  }

  @Get("unread-count")
  async unread(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Patch(":id")
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() _dto: MarkReadDto) {
    return this.notifications.markRead(user.id, id);
  }

  @Post("read-all")
  @HttpCode(200)
  async readAll(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.markAllRead(user.id) };
  }

  @Post("test-reminder")
  testReminder(@CurrentUser() user: AuthUser) {
    return this.notifications.sendTestReminder(user);
  }
}
