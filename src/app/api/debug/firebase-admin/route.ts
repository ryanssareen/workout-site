export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountEnv) {
      return NextResponse.json({
        status: 'MISSING',
        message: 'FIREBASE_SERVICE_ACCOUNT environment variable is not set',
      });
    }

    const valueLength = serviceAccountEnv.length;
    const first20 = serviceAccountEnv.substring(0, 20);
    const last20 = serviceAccountEnv.substring(valueLength - 20);
    
    try {
      const decoded = Buffer.from(serviceAccountEnv, 'base64').toString('utf8');
      
      try {
        const parsed = JSON.parse(decoded);
        
        return NextResponse.json({
          status: 'VALID ✅',
          valueLength,
          first20,
          last20,
          isValidJSON: true,
          hasProjectId: !!parsed.project_id,
          projectId: parsed.project_id,
          hasPrivateKey: !!parsed.private_key,
          hasClientEmail: !!parsed.client_email,
        });
      } catch (jsonError: any) {
        return NextResponse.json({
          status: 'INVALID_JSON ❌',
          valueLength,
          first20,
          last20,
          error: 'Decoded but not valid JSON',
          jsonError: jsonError.message,
          decodedPreview: decoded.substring(0, 100),
        });
      }
    } catch (error: any) {
      return NextResponse.json({
        status: 'DECODE_FAILED ❌',
        valueLength,
        first20,
        last20,
        error: 'Failed to decode base64',
        decodeError: error.message,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      status: 'ERROR ❌',
      error: error.message,
    }, { status: 500 });
  }
}
