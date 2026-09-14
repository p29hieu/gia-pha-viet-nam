import type { Gender, Side } from '../types';

/** Tổ tiên trực hệ: bố → ông → cụ → kỵ → tổ */
export function ancestorTerm(level: number, gender: Gender, side: Side | null): string {
  if (level === 1) return gender === 'M' ? 'bố' : 'mẹ';
  if (level === 2) {
    const base = gender === 'M' ? 'ông' : 'bà';
    if (side === 'noi') return `${base} nội`;
    if (side === 'ngoai') return `${base} ngoại`;
    return base;
  }
  if (level === 3) return gender === 'M' ? 'cụ ông' : 'cụ bà';
  if (level === 4) return gender === 'M' ? 'kỵ ông' : 'kỵ bà';
  return 'tổ';
}

/** Hậu duệ trực hệ: con → cháu → chắt → chút → chít */
export function descendantTerm(level: number, gender: Gender, side: Side | null): string {
  if (level === 1) return gender === 'M' ? 'con trai' : 'con gái';
  if (level === 2) {
    if (side === 'noi') return 'cháu nội';
    if (side === 'ngoai') return 'cháu ngoại';
    return gender === 'M' ? 'cháu trai' : 'cháu gái';
  }
  if (level === 3) return 'chắt';
  if (level === 4) return 'chút';
  return 'chít';
}

/**
 * Anh/chị/em của bố hoặc mẹ — điểm đặc trưng của miền Bắc.
 * "bác" dùng cho CẢ nam lẫn nữ khi vai trên bố/mẹ mình.
 * Chỉ khi là em của bố/mẹ mới tách chú / cô / cậu / dì.
 */
export function parentSiblingTerm(
  gender: Gender,
  side: Side | null,
  olderThanParent: boolean,
): string {
  if (olderThanParent) return 'bác';
  if (side === 'ngoai') return gender === 'M' ? 'cậu' : 'dì';
  return gender === 'M' ? 'chú' : 'cô';
}

/** Anh/chị/em của ông bà */
export function grandparentSiblingTerm(gender: Gender, olderThanGrandparent: boolean): string {
  const base = gender === 'M' ? 'ông' : 'bà';
  return olderThanGrandparent ? `${base} bác` : `${base} trẻ`;
}

/** Anh chị em ruột — xét theo tuổi */
export function siblingTerm(gender: Gender, older: boolean): string {
  if (older) return gender === 'M' ? 'anh' : 'chị';
  return gender === 'M' ? 'em trai' : 'em gái';
}

/** Anh chị em họ — xét theo VAI VẾ của bố mẹ, không theo tuổi */
export function cousinTerm(gender: Gender, senior: boolean): string {
  if (senior) return gender === 'M' ? 'anh họ' : 'chị họ';
  return gender === 'M' ? 'em trai họ' : 'em gái họ';
}

/** Danh xưng cho vợ/chồng của một người họ hàng */
export function spouseOfTerm(relativeTerm: string, spouseGender: Gender): string {
  const table: Record<string, string> = {
    anh: 'chị dâu',
    'chị': 'anh rể',
    'em trai': 'em dâu',
    'em gái': 'em rể',
    'anh họ': 'chị dâu họ',
    'chị họ': 'anh rể họ',
    'em trai họ': 'em dâu họ',
    'em gái họ': 'em rể họ',
    'chú': 'thím',
    'cô': 'chú',
    'cậu': 'mợ',
    'dì': 'chú',
    'chú họ': 'thím họ',
    'cô họ': 'chú họ',
    'cậu họ': 'mợ họ',
    'dì họ': 'chú họ',
    'con trai': 'con dâu',
    'con gái': 'con rể',
    'ông bác': 'bà bác',
    'bà bác': 'ông bác',
    'ông trẻ': 'bà trẻ',
    'bà trẻ': 'ông trẻ',
  };
  const mapped = table[relativeTerm];
  if (mapped) return mapped;

  if (relativeTerm === 'bác') return spouseGender === 'M' ? 'bác trai' : 'bác gái';
  if (relativeTerm === 'bác họ') return spouseGender === 'M' ? 'bác trai họ' : 'bác gái họ';
  if (relativeTerm === 'bố') return 'mẹ';
  if (relativeTerm === 'mẹ') return 'bố';
  if (relativeTerm.startsWith('ông')) return relativeTerm.replace('ông', 'bà');
  if (relativeTerm.startsWith('bà')) return relativeTerm.replace('bà', 'ông');
  if (relativeTerm.startsWith('cháu')) return spouseGender === 'M' ? 'cháu rể' : 'cháu dâu';
  if (relativeTerm.startsWith('chắt')) return spouseGender === 'M' ? 'chắt rể' : 'chắt dâu';
  return spouseGender === 'M' ? `chồng của ${relativeTerm}` : `vợ của ${relativeTerm}`;
}

/**
 * Khi nói chuyện, người Việt xưng bằng chính từ mà đối phương gọi mình,
 * nhưng lược bỏ phần phân biệt giới tính và chữ "họ".
 */
export function toSelfPronoun(term: string): string {
  const base = term
    .replace(/\s+họ$/, '')
    .replace(/\s+(trai|gái)$/, '')
    .replace(/\s+(nội|ngoại)$/, '')
    .trim();
  if (base === 'vợ' || base === 'chồng') return 'tôi';
  return base || 'tôi';
}
