import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import type { Marriage, Member, Note } from '../domain/types';
import type { Account } from './auth';
import { CLAN_ID, requireDb } from './firebase';

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
  backup: Backup,
  options: { dryRun?: boolean } = {},
): Promise<ImportReport> {
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
  const membersRef = collection(db, 'clans', CLAN_ID, 'members');
  const marriagesRef = collection(db, 'clans', CLAN_ID, 'marriages');
  const notesRef = collection(db, 'clans', CLAN_ID, 'notes');

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

  backup.marriages.forEach((w) => {
    const { id, ...rest } = w;
    if (!ids.has(rest.husbandId) || !ids.has(rest.wifeId)) {
      skipped.push(`hon nhan ${id}: thieu mot ben`);
      return;
    }
    batch.set(doc(marriagesRef, id), clean({ ...rest }));
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
