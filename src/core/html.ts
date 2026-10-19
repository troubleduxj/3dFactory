/** 拼接 innerHTML 时使用的转义表（属性值统一用双引号包裹，单双引号都转义） */
const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** HTML 转义：用于拼接 innerHTML 的文本与双引号属性值；null / undefined 输出空字符串 */
export function esc(s: unknown): string {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ESC_MAP[c]!);
}
