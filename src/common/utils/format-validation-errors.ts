import type { ValidationError } from 'class-validator';

/**
 * Làm phẳng lỗi class-validator (kể cả nested / mảng) thành danh sách chuỗi
 * dạng `conversation_starters.0.label: ...` để client hiển thị rõ.
 */
export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  const lines: string[] = [];
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints && Object.keys(err.constraints).length > 0) {
      for (const msg of Object.values(err.constraints)) {
        lines.push(`${path}: ${msg}`);
      }
    }
    if (err.children?.length) {
      lines.push(...formatValidationErrors(err.children, path));
    }
  }
  return lines;
}
