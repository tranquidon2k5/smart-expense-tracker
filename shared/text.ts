/** Bỏ dấu tiếng Việt + chữ thường, dùng cho tìm kiếm và so khớp từ khoá */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
