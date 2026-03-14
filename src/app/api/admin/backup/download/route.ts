export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';
import { generateBackupData } from '@/lib/backup';

// GET — generate a full backup of current state and return it as a JSON file download
export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await generateBackupData();
    const filename = `coachtrack-backup-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
