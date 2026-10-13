import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsNumber } from "class-validator";
import { CurrentUser, type AuthUser } from "../common/auth";
import { BudgetsService } from "./budgets.service";

export class SetBudgetDto {
  @IsNumber({}, { message: "Hạn mức phải là số." }) limitAmount: number;
}

@ApiTags("budgets")
@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query("month") month?: string) {
    return this.budgets.overview(user, month || undefined);
  }

  @Put(":categoryId")
  set(
    @CurrentUser() user: AuthUser,
    @Param("categoryId") categoryId: string,
    @Body() dto: SetBudgetDto,
    @Query("month") month?: string,
  ) {
    return this.budgets.set(user, categoryId, dto.limitAmount, month || undefined);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.budgets.remove(user.id, id);
  }
}
