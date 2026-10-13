import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import type { MissionPeriod, MotivationContext, TransactionType } from "@shared/types";
import { CurrentUser, Roles, type AuthUser } from "../common/auth";
import { AdminService } from "./admin.service";

const MSG = { message: "Dữ liệu chưa hợp lệ." };

export class LockDto {
  @IsBoolean(MSG) isLocked: boolean;
}

export class CategoryDto {
  @IsString(MSG) @MaxLength(60, MSG) name: string;
  @IsIn(["income", "expense"], MSG) type: TransactionType;
  @IsString(MSG) icon: string;
  @IsString(MSG) color: string;
}

export class MotivationDto {
  @IsString(MSG) context: MotivationContext;
  @IsString(MSG) @MaxLength(400, MSG) template: string;
  @IsBoolean(MSG) isActive: boolean;
}

export class ActiveDto {
  @IsBoolean(MSG) isActive: boolean;
}

export class MissionDto {
  @IsOptional() @IsString(MSG) code?: string;
  @IsString(MSG) @MaxLength(120, MSG) title: string;
  @IsIn(["daily", "weekly"], MSG) period: MissionPeriod;
  @IsInt({ message: "Mục tiêu là số nguyên từ 1 đến 100." }) target: number;
  @IsInt({ message: "XP phải là số nguyên." }) xp: number;
  @IsOptional() @IsBoolean(MSG) isActive?: boolean;
}

export class BadgeDto {
  @IsString(MSG) @MaxLength(60, MSG) name: string;
  @IsString(MSG) @MaxLength(160, MSG) condition: string;
  @IsString(MSG) icon: string;
}

/** Mọi route quản trị: kiểm tra vai trò admin ở server (user thường → 403) */
@ApiTags("admin")
@Roles("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  stats() {
    return this.admin.systemStats();
  }

  @Get("users")
  users() {
    return this.admin.listUsers();
  }

  @Patch("users/:id")
  lock(@CurrentUser() me: AuthUser, @Param("id") id: string, @Body() dto: LockDto) {
    return this.admin.setUserLocked(me, id, dto.isLocked);
  }

  @Get("categories")
  categories() {
    return this.admin.listDefaultCategories();
  }

  @Post("categories")
  createCategory(@Body() dto: CategoryDto) {
    return this.admin.saveDefaultCategory(dto);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: CategoryDto) {
    return this.admin.saveDefaultCategory({ ...dto, id });
  }

  @Delete("categories/:id")
  @HttpCode(204)
  deleteCategory(@Param("id") id: string) {
    return this.admin.deleteDefaultCategory(id);
  }

  @Get("motivation")
  motivation() {
    return this.admin.listMotivation();
  }

  @Post("motivation")
  createMotivation(@Body() dto: MotivationDto) {
    return this.admin.saveMotivation(dto);
  }

  @Patch("motivation/:id")
  updateMotivation(@Param("id") id: string, @Body() dto: MotivationDto) {
    return this.admin.saveMotivation({ ...dto, id });
  }

  @Patch("motivation/:id/active")
  @HttpCode(204)
  setActive(@Param("id") id: string, @Body() dto: ActiveDto) {
    return this.admin.setMotivationActive(id, dto.isActive);
  }

  @Delete("motivation/:id")
  @HttpCode(204)
  deleteMotivation(@Param("id") id: string) {
    return this.admin.deleteMotivation(id);
  }

  @Get("missions")
  missions() {
    return this.admin.listMissions();
  }

  @Post("missions")
  createMission(@Body() dto: MissionDto) {
    return this.admin.saveMission(dto);
  }

  @Patch("missions/:id")
  updateMission(@Param("id") id: string, @Body() dto: MissionDto) {
    return this.admin.saveMission({ ...dto, id });
  }

  @Get("badges")
  badges() {
    return this.admin.listBadges();
  }

  @Patch("badges/:id")
  saveBadge(@Param("id") id: string, @Body() dto: BadgeDto) {
    return this.admin.saveBadge({ ...dto, id });
  }
}
