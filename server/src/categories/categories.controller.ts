import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength } from "class-validator";
import type { TransactionType } from "@shared/types";
import { CurrentUser, type AuthUser } from "../common/auth";
import { CategoriesService } from "./categories.service";

const MSG = { message: "Dữ liệu chưa hợp lệ." };

export class UpdateCategoryDto {
  @IsString(MSG) @MaxLength(60, MSG) name: string;
  @IsString(MSG) icon: string;
  @IsString(MSG) color: string;
}

export class CreateCategoryDto extends UpdateCategoryDto {
  @IsIn(["income", "expense"], { message: "Chọn loại thu hoặc chi." }) type: TransactionType;
}

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("type") type?: string) {
    return this.categories.list(user.id, type === "income" || type === "expense" ? type : undefined);
  }

  @Get("usage")
  usage(@CurrentUser() user: AuthUser) {
    return this.categories.usage(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user.id, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("moveTo") moveTo?: string) {
    return this.categories.remove(user.id, id, moveTo || undefined);
  }
}
