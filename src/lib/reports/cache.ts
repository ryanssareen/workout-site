import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import type { StructuredReport } from '@/types/reports';
import type { DeepDiveReportType } from '@/types/reports-hub';
import crypto from 'crypto';

/** Build a deterministic cache key from report type + params */
function buildCacheKey(type: DeepDiveReportType, params: Record<string, string>): string {
  const sortedParams = JSON.stringify(
    Object.keys(params).sort().reduce((acc, k) => ({ ...acc, [k]: params[k] }), {})
  );
  const hash = crypto.createHash('md5').update(sortedParams).digest('hex').slice(0, 8);
  return `${type}_${hash}`;
}

export async function getCachedReport(
  username: string,
  type: DeepDiveReportType,
  params: Record<string, string>,
): Promise<StructuredReport | null> {
  try {
    const key = buildCacheKey(type, params);
    const docRef = adminDb
      .collection('users')
      .doc(username)
      .collection('cachedReports')
      .doc(key);

    const doc = await docRef.get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    const expiresAt = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);

    if (expiresAt <= new Date()) {
      // Expired — delete and return null
      await docRef.delete().catch(() => {});
      return null;
    }

    return data.report as StructuredReport;
  } catch (err) {
    console.error('Cache read error:', err);
    return null;
  }
}

export async function setCachedReport(
  username: string,
  type: DeepDiveReportType,
  params: Record<string, string>,
  report: StructuredReport,
  ttlHours: number,
): Promise<void> {
  try {
    const key = buildCacheKey(type, params);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await adminDb
      .collection('users')
      .doc(username)
      .collection('cachedReports')
      .doc(key)
      .set({
        reportType: type,
        params,
        report,
        generatedAt: admin.firestore.Timestamp.fromDate(now),
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      });
  } catch (err) {
    console.error('Cache write error:', err);
  }
}
