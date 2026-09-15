export type Gender = 'M' | 'F';

export interface Member {
  id: string;
  fullName: string;
  gender: Gender;
  /** yyyy-mm-dd | yyyy-mm | yyyy — cho phép khuyết vì gia phả cũ thường thiếu ngày */
  birthDate?: string;
  deathDate?: string;
  /** Thứ tự sinh trong gia đình, 1 là con cả. Quyết định vai vế anh/chị/em. */
  birthOrder?: number;
  address?: string;
  occupation?: string;
  /** Cha mẹ ruột — cơ sở duy nhất để tính danh xưng và dựng cây huyết thống. */
  fatherId?: string;
  motherId?: string;
  /** Cha mẹ nuôi. Ghi riêng để không lẫn vào huyết thống. */
  adoptiveFatherId?: string;
  adoptiveMotherId?: string;
  /** Cha mẹ đỡ đầu. */
  godFatherId?: string;
  godMotherId?: string;
  photoUrl?: string;
}

export type MarriageStatus = 'married' | 'divorced' | 'widowed';

export interface Marriage {
  id: string;
  husbandId: string;
  wifeId: string;
  status: MarriageStatus;
  startDate?: string;
  endDate?: string;
  order?: number;
}

export interface Note {
  id: string;
  memberId: string;
  authorName: string;
  content: string;
  createdAt: string;
  /** Ghi chú này do chính mình viết — máy chủ tự tính, không lộ mã của người khác. */
  mine?: boolean;
}

/** Bên nội (qua bố) hay bên ngoại (qua mẹ) */
export type Side = 'noi' | 'ngoai';

export type KinCategory =
  | 'ban-than'
  | 'huyet-thong'
  | 'hon-nhan'
  | 'ben-vo-chong'
  | 'nuoi-duong'
  | 'khong-xac-dinh';

/** Một chặng trong chuỗi "có họ thông qua ai" */
export interface KinPathStep {
  memberId: string;
  /** Danh xưng của chặng này so với chặng trước, vd "bố", "ông nội" */
  label: string;
}

export interface Kinship {
  /** Tôi gọi người đó là gì */
  callThem: string;
  /** Người đó gọi tôi là gì */
  theyCallMe: string;
  /** Tôi xưng là gì khi nói chuyện với người đó */
  iCallMyself: string;
  category: KinCategory;
  side: Side | 'vo' | 'chong' | null;
  /** Số đời chênh lệch; dương nghĩa là người đó ở vai trên */
  generationGap: number;
  commonAncestorId: string | null;
  /** Chuỗi liên kết từ tôi tới người đó */
  path: KinPathStep[];
  /**
   * Quan hệ nuôi hoặc đỡ đầu giữa hai người, nếu có.
   * KHÔNG tính vào danh xưng huyết thống — chỉ hiển thị kèm, vì nó là lời khai
   * báo trực tiếp chứ không phải quan hệ máu mủ suy ra được từ cây.
   */
  care?: { callThem: string; theyCallMe: string };
  explanation: string;
  warnings: string[];
}
