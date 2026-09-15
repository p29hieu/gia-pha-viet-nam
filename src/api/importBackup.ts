import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import type { Marriage, Member, Note } from '../domain/types';
import type { Account } from './auth';
import { requireDb } from './firebase';

export interface Backup {
  members: Member[];
  marriages: Marriage[];
  notes?: Array<Note & { authorCode?: string }>;
}

export interface ImportReport {
  dryRun: boolean;
  members: number;
  marriages: number;
  notes: number;
  skipped: string[];
  warnings: string[];
}

/**
 * Chuyen gia pha tu ban sao luu Google Sheet sang Firestore.
 *
 * Giu nguyen id cu lam id document thay vi de Firestore tu sinh: fatherId,
 * motherId, husbandId, wifeId trong ban sao luu deu tro theo id cu, nen giu
 * nguyen la moi lien ket con dung ma khong can bang anh xa.
 *
 * Chay lai nhieu lan van an toan: moi document ghi de chinh no.
 */
export async function importBackup(
  account: Account,
  /** Bắt buộc nêu rõ: đây là công cụ ghi đè hàng loạt, mặc định ngầm là thứ gây ghi nhầm cây. */
  clanId: string,
  backup: Backup,
  options: { dryRun?: boolean } = {},
): Promise<ImportReport> {
  if (!clanId) throw new Error('Phải nêu rõ clanId muốn ghi vào');
  const dryRun = options.dryRun ?? false;
  const db = requireDb();
  const warnings: string[] = [];
  const skipped: string[] = [];

  const ids = new Set(backup.members.map((m) => m.id));
  backup.members.forEach((m) => {
    if (m.fatherId && !ids.has(m.fatherId)) {
      warnings.push(`${m.fullName}: cha ${m.fatherId} khong co trong ban sao luu`);
    }
    if (m.motherId && !ids.has(m.motherId)) {
      warnings.push(`${m.fullName}: me ${m.motherId} khong co trong ban sao luu`);
    }
  });

  const clean = (obj: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  };

  const now = new Date().toISOString();
  const membersRef = collection(db, 'clans', clanId, 'members');
  const marriagesRef = collection(db, 'clans', clanId, 'marriages');
  const notesRef = collection(db, 'clans', clanId, 'notes');

  if (dryRun) {
    return {
      dryRun: true,
      members: backup.members.length,
      marriages: backup.marriages.length,
      notes: backup.notes?.length ?? 0,
      skipped,
      warnings,
    };
  }

  const batch = writeBatch(db);

  backup.members.forEach((m) => {
    const { id, ...rest } = m;
    const order = Number(rest.birthOrder);
    batch.set(
      doc(membersRef, id),
      clean({
        ...rest,
        birthOrder: Number.isFinite(order) && order > 0 ? order : undefined,
        createdAt: now,
        updatedAt: now,
        createdBy: account.uid,
      }),
    );
  });

  const gender = new Map(backup.members.map((m) => [m.id, m.gender]));
  const seen = new Set<string>();

  backup.marriages.forEach((w) => {
    const { id, ...rest } = w;
    if (!ids.has(rest.husbandId) || !ids.has(rest.wifeId)) {
      skipped.push(`hon nhan ${id}: thieu mot ben`);
      return;
    }

    // Moi nguoi chi duoc mot day hon phoi. Du lieu cu co the vi pham, nen bo qua
    // va bao lai thay vi am tham nap vao roi de sai quy tac.
    if (seen.has(rest.husbandId) || seen.has(rest.wifeId)) {
      skipped.push(`hon nhan ${id}: mot ben da co day hon phoi khac`);
      return;
    }
    seen.add(rest.husbandId);
    seen.add(rest.wifeId);

    // Ban cu xep vai theo gioi tinh nguoi vua them nen co cap bi dao nguoc.
    let { husbandId, wifeId } = rest;
    if (gender.get(husbandId) === 'F' && gender.get(wifeId) === 'M') {
      [husbandId, wifeId] = [wifeId, husbandId];
      warnings.push(`hon nhan ${id}: da dao lai dung vai chong/vo`);
    }

    batch.set(doc(marriagesRef, id), clean({ ...rest, husbandId, wifeId }));
  });

  (backup.notes ?? []).forEach((n) => {
    const { id, authorCode, ...rest } = n;
    void authorCode; // khong mang ma dang nhap cu sang
    batch.set(doc(notesRef, id), clean({ ...rest, authorUid: account.uid }));
  });

  await batch.commit();

  const [memberSnap, marriageSnap, noteSnap] = await Promise.all([
    getDocs(membersRef),
    getDocs(marriagesRef),
    getDocs(notesRef),
  ]);

  return {
    dryRun: false,
    members: memberSnap.size,
    marriages: marriageSnap.size,
    notes: noteSnap.size,
    skipped,
    warnings,
  };
}
