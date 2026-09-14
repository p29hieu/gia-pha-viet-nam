/** Bỏ dấu tiếng Việt để tìm kiếm gõ không dấu vẫn ra kết quả. */
export function removeDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function searchKey(input: string): string {
  return removeDiacritics(input).toLowerCase().trim();
}

/** Khớp khi mọi từ trong truy vấn đều xuất hiện trong tên. */
export function matchesName(fullName: string, query: string): boolean {
  const q = searchKey(query);
  if (!q) return true;
  const name = searchKey(fullName);
  return q.split(/\s+/).every((word) => name.includes(word));
}

/** "1930" | "1930-05" | "1930-05-12" -> "1930" | "05/1930" | "12/05/1930" */
export function formatVnDate(value: string | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!m || !m[1]) return value;
  if (m[3] && m[2]) return `${m[3]}/${m[2]}/${m[1]}`;
  if (m[2]) return `${m[2]}/${m[1]}`;
  return m[1];
}

export function lifespan(birth?: string, death?: string): string {
  const b = birth?.slice(0, 4);
  const d = death?.slice(0, 4);
  if (b && d) return `${b} – ${d}`;
  if (b) return `${b}`;
  if (d) return `mất ${d}`;
  return '';
}
