import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';

export async function POST(request: NextRequest) {
  try {
    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');

    if (isMock) {
      return NextResponse.json({ error: 'Mock mode does not support real uploads.' }, { status: 400 });
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('trade-attachments')
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('trade-attachments')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      publicUrl
    });
  } catch (err: any) {
    console.error('Upload API route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
