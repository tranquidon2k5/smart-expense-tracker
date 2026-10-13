import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import type { AmountMode, CsvColumnMapping, ImportRequest, ParsedCsv } from "@shared/types";
import { CurrentUser, type AuthUser } from "../common/auth";
import { ChatService } from "../chat/chat.service";
import { ImportService } from "../import/import.service";
import { TransactionsService } from "../transactions/transactions.service";
import { AiService } from "./ai.service";

const MSG = { message: "Dữ liệu chưa hợp lệ." };

export class QuickEntryParseDto {
  @IsString(MSG) @MaxLength(200, { message: "Câu ghi nhanh tối đa 200 ký tự." }) text: string;
}

export class QuickEntryPreviewDto {
  @IsString(MSG) @MaxLength(200, MSG) rawText: string;
  @IsOptional() @IsNumber({}, MSG) amount: number | null;
  @IsIn(["income", "expense"], MSG) type: "income" | "expense";
  @Matches(/^\d{4}-\d{2}-\d{2}$/, MSG) date: string;
  @IsString(MSG) @MaxLength(255, MSG) description: string;
  @IsOptional() @IsString(MSG) categoryId: string | null;
  @IsNumber({}, MSG) confidence: number;
  @IsString(MSG) walletId: string;
}

export class AskDto {
  @IsOptional() @IsString(MSG) conversationId?: string | null;
  @IsString(MSG) @MaxLength(300, { message: "Câu hỏi tối đa 300 ký tự." }) question: string;
}

export class SourcesDto {
  @IsArray(MSG) @ArrayMaxSize(500, MSG) @IsString({ ...MSG, each: true }) ids: string[];
}

class ParsedCsvDto implements ParsedCsv {
  @IsString(MSG) @MaxLength(255, MSG) fileName: string;
  @IsString(MSG) @MaxLength(4, MSG) delimiter: string;
  @IsBoolean(MSG) hasHeader: boolean;
  @IsArray(MSG) @ArrayMaxSize(100, MSG) headers: string[];
  @IsArray(MSG) @ArrayMaxSize(5000, { message: "File có hơn 5000 dòng. Hãy chia nhỏ theo tháng." }) rows: string[][];
  @IsArray(MSG) @IsInt({ ...MSG, each: true }) lineNumbers: number[];
}

export class ImportDto implements ImportRequest {
  @ValidateNested() @Type(() => ParsedCsvDto) file: ParsedCsvDto;
  @IsObject(MSG) mapping: CsvColumnMapping;
  @IsIn(["signed", "all_expense"], MSG) amountMode: AmountMode;
  @IsString(MSG) walletId: string;
}

@ApiTags("ai")
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Câu tự nhiên → bản xem trước (chưa lưu) */
  @Post("quick-entry/parse")
  @HttpCode(200)
  parse(@CurrentUser() user: AuthUser, @Body() dto: QuickEntryParseDto) {
    return this.ai.parseQuickEntry(user, dto.text);
  }

  @Post("quick-entry")
  create(@CurrentUser() user: AuthUser, @Body() dto: QuickEntryPreviewDto) {
    return this.ai.createFromQuickEntry(user, dto);
  }
}

@ApiTags("import")
@Controller("import")
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  /** Các dòng đã đọc + ánh xạ ở trình duyệt; server kiểm tra lại toàn bộ */
  @Post("csv")
  importCsv(@CurrentUser() user: AuthUser, @Body() dto: ImportDto) {
    return this.importer.importCsv(user, dto);
  }
}

@ApiTags("chat")
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly transactions: TransactionsService,
  ) {}

  @Get("conversations")
  list(@CurrentUser() user: AuthUser) {
    return this.chat.list(user.id);
  }

  @Get("conversations/:id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chat.get(user.id, id);
  }

  @Delete("conversations/:id")
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chat.remove(user.id, id);
  }

  @Post("ask")
  ask(@CurrentUser() user: AuthUser, @Body() dto: AskDto) {
    return this.chat.ask(user, dto.conversationId ?? null, dto.question);
  }

  /** Giao dịch nguồn của một câu trả lời (bỏ qua giao dịch đã bị xoá) */
  @Post("sources")
  @HttpCode(200)
  sources(@CurrentUser() user: AuthUser, @Body() dto: SourcesDto) {
    return this.transactions.byIds(user.id, dto.ids);
  }
}
