import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { requireDb } from './firebase';

/**
 * Vá trường `uid` cho các bản ghi thành viên đã có từ trước.
 *
 * Truy vấn "tôi đang ở những cây gia phả nào" chạy trên collection group và
 * lọc theo trường `uid`; luật bảo mật cũng dựa vào chính trường đó. Bản ghi
 * tạo trước khi có tính năng nhiều cây chưa có trường này, nên sẽ không hiện
 * ra ở màn chọn cây — người dùng tưởng mất gia phả.
 *
 * Công cụ chạy tay một lần, chỉ có ở chế độ DEV. Nguyên tắc: **chỉ thêm đúng
 * một trường**, không sửa và không xoá bất cứ trường nào khác. Chạy lại nhiều
 * lần vẫn an toàn vì bản ghi đã đúng thì bị bỏ qua.
 *
 * Dùng:
 *   await __giaphaBackfillUid('main')                    // chạy thử, không ghi
 *   await __giaphaBackfillUid('main', { dryRun: false }) // ghi thật
 */

export interface BackfillReport {
  dryRun: boolean;
  clanId: string;
  tong: number;
  /** Bản ghi đã có uid đúng — bỏ qua. */
  boQua: string[];
  /** Bản ghi sẽ được (hoặc đã được) thêm uid. */
  daVa: string[];
  /** Bản ghi có uid nhưng KHÁC id document — không tự sửa, báo để người xem quyết. */
  canXem: Array<{ id: string; uidDangCo: string }>;
}

export async function backfillUid(
  clanId: string,
  options: { dryRun?: boolean } = {},
): Promise<BackfillReport> {
  const dryRun = options.dryRun ?? true;
  if (!clanId) throw new Error('Phải nêu rõ clanId');

  const db = requireDb();
  const ref = collection(db, 'clans', clanId, 'memberships');
  const snap = await getDocs(ref);

  const report: BackfillReport = {
    dryRun,
    clanId,
    tong: snap.size,
    boQua: [],
    daVa: [],
    canXem: [],
  };

  for (const d of snap.docs) {
    const dangCo = d.data().uid;
    if (dangCo === d.id) {
      report.boQua.push(d.id);
      continue;
    }
    if (typeof dangCo === 'string' && dangCo.length > 0) {
      // Không tự sửa: một giá trị khác id document là chuyện bất thường,
      // người xem phải tự quyết chứ máy không nên đoán.
      report.canXem.push({ id: d.id, uidDangCo: dangCo });
      continue;
    }
    if (!dryRun) await updateDoc(doc(ref, d.id), { uid: d.id });
    report.daVa.push(d.id);
  }

  return report;
}
