export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/admin-auth';

// Deprecated — use POST /api/admin/restore with { username } instead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(
    {
      error:
        'This endpoint is no longer supported. Use POST /api/admin/restore with { data, username } instead.',
    },
    { status: 410 }
  );
}
