import type { Marriage, Member } from './types';

/**
 * Gia phả mẫu 5 đời quanh nhân vật `ego` (Nguyễn Văn An, nam, 1960).
 * Cố ý cài sẵn các ca khó:
 *  - `con_bac` sinh 1970 (ít tuổi hơn ego) nhưng là ANH HỌ vì bố là bác.
 *  - `con_co`  sinh 1950 (nhiều tuổi hơn ego) nhưng là EM HỌ vì mẹ là cô.
 *  - `em_cung_cha` là em cùng cha khác mẹ.
 */
export const SAMPLE_MEMBERS: Member[] = [
  // Đời 0 — cụ
  { id: 'p0_cu', fullName: 'Nguyễn Văn Cụ', gender: 'M', birthDate: '1875', deathDate: '1950' },
  { id: 'p0_cu_ba', fullName: 'Đặng Thị Cụ', gender: 'F', birthDate: '1878', deathDate: '1955' },

  // Đời 1 — ông bà nội và em trai ông nội
  { id: 'noi_ong', fullName: 'Nguyễn Văn Bình', gender: 'M', birthDate: '1900', deathDate: '1975', birthOrder: 1, fatherId: 'p0_cu', motherId: 'p0_cu_ba' },
  { id: 'noi_ba', fullName: 'Trần Thị Bình', gender: 'F', birthDate: '1903', deathDate: '1980' },
  { id: 'noi_ong_em', fullName: 'Nguyễn Văn Cường', gender: 'M', birthDate: '1910', birthOrder: 2, fatherId: 'p0_cu', motherId: 'p0_cu_ba' },
  { id: 'noi_ong_em_vo', fullName: 'Vũ Thị Cường', gender: 'F', birthDate: '1913' },

  // Đời 1 — ông bà ngoại
  { id: 'ngoai_ong', fullName: 'Lê Văn Đức', gender: 'M', birthDate: '1905' },
  { id: 'ngoai_ba', fullName: 'Phạm Thị Đức', gender: 'F', birthDate: '1908' },

  // Đời 2 — bên nội
  { id: 'bac_noi', fullName: 'Nguyễn Văn Cả', gender: 'M', birthDate: '1925', birthOrder: 1, fatherId: 'noi_ong', motherId: 'noi_ba' },
  { id: 'bac_noi_vo', fullName: 'Hoàng Thị Cả', gender: 'F', birthDate: '1928' },
  { id: 'bo', fullName: 'Nguyễn Văn Hai', gender: 'M', birthDate: '1930', birthOrder: 2, fatherId: 'noi_ong', motherId: 'noi_ba' },
  { id: 'co', fullName: 'Nguyễn Thị Ba', gender: 'F', birthDate: '1935', birthOrder: 3, fatherId: 'noi_ong', motherId: 'noi_ba' },
  { id: 'co_chong', fullName: 'Trần Văn Rể', gender: 'M', birthDate: '1932' },
  { id: 'chu', fullName: 'Nguyễn Văn Tư', gender: 'M', birthDate: '1938', birthOrder: 4, fatherId: 'noi_ong', motherId: 'noi_ba' },
  { id: 'chu_vo', fullName: 'Đinh Thị Tư', gender: 'F', birthDate: '1941' },
  { id: 'chu_ho', fullName: 'Nguyễn Văn Họ', gender: 'M', birthDate: '1945', birthOrder: 1, fatherId: 'noi_ong_em', motherId: 'noi_ong_em_vo' },

  // Đời 2 — bên ngoại
  { id: 'bac_ngoai', fullName: 'Lê Văn Trưởng', gender: 'M', birthDate: '1928', birthOrder: 1, fatherId: 'ngoai_ong', motherId: 'ngoai_ba' },
  { id: 'bac_ngoai_vo', fullName: 'Ngô Thị Trưởng', gender: 'F', birthDate: '1930' },
  { id: 'me', fullName: 'Lê Thị Mai', gender: 'F', birthDate: '1933', birthOrder: 2, fatherId: 'ngoai_ong', motherId: 'ngoai_ba' },
  { id: 'cau', fullName: 'Lê Văn Út', gender: 'M', birthDate: '1940', birthOrder: 3, fatherId: 'ngoai_ong', motherId: 'ngoai_ba' },
  { id: 'cau_vo', fullName: 'Bùi Thị Út', gender: 'F', birthDate: '1944' },
  { id: 'di', fullName: 'Lê Thị Dịu', gender: 'F', birthDate: '1943', birthOrder: 4, fatherId: 'ngoai_ong', motherId: 'ngoai_ba' },
  { id: 'di_chong', fullName: 'Phan Văn Dượng', gender: 'M', birthDate: '1940' },

  // Đời 2 — mẹ kế (vợ hai của bố)
  { id: 'me_ke', fullName: 'Ngô Thị Hậu', gender: 'F', birthDate: '1945' },

  // Đời 3 — ego và anh chị em
  { id: 'anh', fullName: 'Nguyễn Văn Anh', gender: 'M', birthDate: '1957', birthOrder: 1, fatherId: 'bo', motherId: 'me' },
  { id: 'anh_vo', fullName: 'Vương Thị Thanh', gender: 'F', birthDate: '1959' },
  { id: 'ego', fullName: 'Nguyễn Văn An', gender: 'M', birthDate: '1960', birthOrder: 2, fatherId: 'bo', motherId: 'me' },
  { id: 'em_gai', fullName: 'Nguyễn Thị Em', gender: 'F', birthDate: '1965', birthOrder: 3, fatherId: 'bo', motherId: 'me' },
  { id: 'em_gai_chong', fullName: 'Đỗ Văn Rể', gender: 'M', birthDate: '1963' },
  { id: 'em_cung_cha', fullName: 'Nguyễn Văn Hậu', gender: 'M', birthDate: '1972', birthOrder: 4, fatherId: 'bo', motherId: 'me_ke' },

  // Đời 3 — anh chị em họ
  { id: 'con_bac', fullName: 'Nguyễn Văn Bảo', gender: 'M', birthDate: '1970', birthOrder: 1, fatherId: 'bac_noi', motherId: 'bac_noi_vo' },
  { id: 'con_co', fullName: 'Trần Thị Hoa', gender: 'F', birthDate: '1950', birthOrder: 1, fatherId: 'co_chong', motherId: 'co' },
  { id: 'con_bac_ngoai', fullName: 'Lê Thị Lan', gender: 'F', birthDate: '1955', birthOrder: 1, fatherId: 'bac_ngoai', motherId: 'bac_ngoai_vo' },

  // Đời 3 — nhà vợ
  { id: 'vo_bo', fullName: 'Trần Văn Nhạc', gender: 'M', birthDate: '1935' },
  { id: 'vo_me', fullName: 'Đỗ Thị Nhạc', gender: 'F', birthDate: '1938' },
  { id: 'vo_anh', fullName: 'Trần Văn Cả', gender: 'M', birthDate: '1958', birthOrder: 1, fatherId: 'vo_bo', motherId: 'vo_me' },
  { id: 'ego_vo', fullName: 'Trần Thị Vân', gender: 'F', birthDate: '1962', birthOrder: 2, fatherId: 'vo_bo', motherId: 'vo_me' },

  // Đời 4
  { id: 'con_trai', fullName: 'Nguyễn Văn Minh', gender: 'M', birthDate: '1990-05-12', birthOrder: 1, fatherId: 'ego', motherId: 'ego_vo' },
  { id: 'con_dau', fullName: 'Bùi Thị Thu', gender: 'F', birthDate: '1992' },
  { id: 'con_gai', fullName: 'Nguyễn Thị Hương', gender: 'F', birthDate: '1993-09-01', birthOrder: 2, fatherId: 'ego', motherId: 'ego_vo' },
  { id: 'chau_anh', fullName: 'Nguyễn Văn Khoa', gender: 'M', birthDate: '1985', birthOrder: 1, fatherId: 'anh', motherId: 'anh_vo' },

  // Đời 5
  { id: 'chau_noi', fullName: 'Nguyễn Văn Nam', gender: 'M', birthDate: '2015', birthOrder: 1, fatherId: 'con_trai', motherId: 'con_dau' },
];

export const SAMPLE_MARRIAGES: Marriage[] = [
  { id: 'w1', husbandId: 'p0_cu', wifeId: 'p0_cu_ba', status: 'married' },
  { id: 'w2', husbandId: 'noi_ong', wifeId: 'noi_ba', status: 'married' },
  { id: 'w3', husbandId: 'noi_ong_em', wifeId: 'noi_ong_em_vo', status: 'married' },
  { id: 'w4', husbandId: 'ngoai_ong', wifeId: 'ngoai_ba', status: 'married' },
  { id: 'w5', husbandId: 'bac_noi', wifeId: 'bac_noi_vo', status: 'married' },
  { id: 'w6', husbandId: 'bo', wifeId: 'me', status: 'married', order: 1 },
  { id: 'w7', husbandId: 'bo', wifeId: 'me_ke', status: 'married', order: 2 },
  { id: 'w8', husbandId: 'co_chong', wifeId: 'co', status: 'married' },
  { id: 'w9', husbandId: 'chu', wifeId: 'chu_vo', status: 'married' },
  { id: 'w10', husbandId: 'bac_ngoai', wifeId: 'bac_ngoai_vo', status: 'married' },
  { id: 'w11', husbandId: 'cau', wifeId: 'cau_vo', status: 'married' },
  { id: 'w12', husbandId: 'di_chong', wifeId: 'di', status: 'married' },
  { id: 'w13', husbandId: 'anh', wifeId: 'anh_vo', status: 'married' },
  { id: 'w14', husbandId: 'ego', wifeId: 'ego_vo', status: 'married' },
  { id: 'w15', husbandId: 'em_gai_chong', wifeId: 'em_gai', status: 'married' },
  { id: 'w16', husbandId: 'vo_bo', wifeId: 'vo_me', status: 'married' },
  { id: 'w17', husbandId: 'con_trai', wifeId: 'con_dau', status: 'married' },
];
