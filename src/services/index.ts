/**
 * Điểm truy cập dữ liệu duy nhất cho giao diện.
 * Hiện trả dữ liệu giả lập (src/services/mock); khi có backend chỉ cần thay
 * phần thân các hàm bằng lời gọi REST, chữ ký giữ nguyên.
 * Giao diện KHÔNG import trực tiếp từ src/services/mock.
 */
export * as dashboardService from "./dashboard.service";
export * as transactionService from "./transaction.service";
export * as gamificationService from "./gamification.service";
export { onDataChanged } from "./events";
