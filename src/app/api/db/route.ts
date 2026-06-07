import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth-verify';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const user = await getUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, payload } = await request.json();
    const adminSupabase = createAdminClient();

    switch (action) {
      case 'fetchAccounts': {
        const { data, error } = await adminSupabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return NextResponse.json({ data });
      }
      
      case 'archiveAccount': {
        const { id, archive } = payload;
        const { error } = await adminSupabase
          .from('accounts')
          .update({ is_archived: archive })
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'saveAccount': {
        const { account, propFirmDetails } = payload;
        
        // Insert Account
        const { data: dbAccount, error: accError } = await adminSupabase
          .from('accounts')
          .insert([{ ...account, user_id: user.id }])
          .select()
          .single();

        if (accError) throw accError;

        // Insert Prop Profile if applicable
        if (propFirmDetails && (account.account_type === 'Prop Challenge' || account.account_type === 'Funded Account')) {
          const { error: propError } = await adminSupabase
            .from('prop_firm_profiles')
            .insert([{ ...propFirmDetails, account_id: dbAccount.id }]);

          if (propError) throw propError;
        }

        return NextResponse.json({ data: dbAccount });
      }

      case 'fetchPropFirmProfile': {
        const { accountId } = payload;
        const { data, error } = await adminSupabase
          .from('prop_firm_profiles')
          .select('*')
          .eq('account_id', accountId)
          .single();
        if (error && error.code !== 'PGRST116') throw error; // Ignore not found error
        return NextResponse.json({ data: data || null });
      }

      case 'fetchTrades': {
        const { accountId } = payload;
        let query = adminSupabase.from('trades').select('*').eq('user_id', user.id);
        if (accountId) {
          query = query.eq('account_id', accountId);
        }
        const { data, error } = await query.order('open_time', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ data });
      }

      case 'saveTrade': {
        const { trade } = payload;
        const { data, error } = await adminSupabase
          .from('trades')
          .insert([{ ...trade, user_id: user.id }])
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ data });
      }

      case 'deleteTrade': {
        const { id } = payload;
        const { error } = await adminSupabase
          .from('trades')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case 'updateTrade': {
        const { id, updates } = payload;
        const { data, error } = await adminSupabase
          .from('trades')
          .update(updates)
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ data });
      }

      case 'fetchReflections': {
        const { accountId } = payload;
        let query = adminSupabase.from('daily_reflections').select('*').eq('user_id', user.id);
        if (accountId) {
          query = query.eq('account_id', accountId);
        }
        const { data, error } = await query.order('reflection_date', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ data });
      }

      case 'saveReflection': {
        const { reflection } = payload;
        const { data, error } = await adminSupabase
          .from('daily_reflections')
          .upsert({ ...reflection, user_id: user.id }, { onConflict: 'user_id,reflection_date' })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ data });
      }

      case 'fetchUserProfile': {
        const { data, error } = await adminSupabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error && error.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await adminSupabase
            .from('profiles')
            .insert([{
              id: user.id,
              email: user.email || '',
              full_name: user.full_name || '',
              avatar_url: user.avatar_url || ''
            }])
            .select()
            .single();
          if (insertError) throw insertError;
          return NextResponse.json({ data: newProfile });
        }
        if (error) throw error;
        return NextResponse.json({ data });
      }

      case 'updateUserProfile': {
        const { updates } = payload;
        const { data, error } = await adminSupabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ data });
      }

      default:
        return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Unified DB endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal database error' }, { status: 500 });
  }
}
