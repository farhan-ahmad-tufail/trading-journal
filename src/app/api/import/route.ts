import { NextRequest, NextResponse } from 'next/server';
import { parseMT5Html, parseMT5Csv, ParsedTrade } from '@/lib/parsers/mt5Parser';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const accountId = formData.get('accountId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ error: 'No account ID provided' }, { status: 400 });
    }

    const fileText = await file.text();
    const fileName = file.name.toLowerCase();

    // 1. Execute parser based on extension
    let parsedTrades: ParsedTrade[] = [];
    if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      parsedTrades = parseMT5Html(fileText);
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
      parsedTrades = parseMT5Csv(fileText);
    } else {
      return NextResponse.json({ error: 'Unsupported file format. Please upload MT5 HTML or CSV.' }, { status: 400 });
    }

    if (parsedTrades.length === 0) {
      return NextResponse.json({ error: 'No valid closed positions found in the statement.' }, { status: 422 });
    }

    // 2. Check Mock Mode
    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');

    if (isMock) {
      // In Mock Mode, return the parsed trades back to the frontend so it can save them locally in localStorage
      return NextResponse.json({
        success: true,
        isMockMode: true,
        trades: parsedTrades
      });
    }

    // 3. Real Database Flow
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated user' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch existing trade tickets for this account to avoid duplicates
    const { data: existingTrades, error: fetchError } = await supabase
      .from('trades')
      .select('external_ticket')
      .eq('account_id', accountId)
      .not('external_ticket', 'is', null);

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to verify existing trades in database.' }, { status: 500 });
    }

    const existingTickets = new Set(existingTrades.map((t: any) => String(t.external_ticket)));

    // Filter out duplicates
    const newTrades = parsedTrades.filter(t => !existingTickets.has(String(t.external_ticket)));

    if (newTrades.length === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        message: 'All trades in the statement have already been imported.'
      });
    }

    // Prepare insertion payload
    const tradesToInsert = newTrades.map(t => ({
      user_id: user.id,
      account_id: accountId,
      pair: t.pair,
      direction: t.direction,
      session: getSessionFromTime(t.open_time),
      setup_grade: 'B', // default grade
      pre_trade_state: 'Focused',
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      stop_loss: t.stop_loss,
      take_profit: t.take_profit,
      lot_size: t.lot_size,
      commission: t.commission,
      swap: t.swap,
      pnl: t.pnl,
      status: 'CLOSED',
      open_time: t.open_time,
      close_time: t.close_time,
      duration_seconds: t.duration_seconds,
      import_source: fileName.endsWith('.html') || fileName.endsWith('.htm') ? 'MT5_HTML' : 'MT5_CSV',
      external_ticket: t.external_ticket
    }));

    // Batch insert trades
    const { error: insertError } = await supabase
      .from('trades')
      .insert(tradesToInsert);

    if (insertError) {
      return NextResponse.json({ error: 'Failed to insert parsed trades into database.' }, { status: 500 });
    }

    // Update account statistics
    await updateAccountStats(accountId, supabase);

    return NextResponse.json({
      success: true,
      inserted: tradesToInsert.length,
      message: `Successfully imported ${tradesToInsert.length} trades.`
    });

  } catch (err: any) {
    console.error('Import API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error during import.' }, { status: 500 });
  }
}

/**
 * Derives trading session from UTC hour
 */
function getSessionFromTime(timeString: string): string {
  const date = new Date(timeString);
  const hour = date.getUTCHours();
  
  if (hour >= 0 && hour < 8) return 'ASIAN';
  if (hour >= 8 && hour < 13) return 'LONDON';
  if (hour >= 13 && hour < 17) return 'LONDON_NY';
  return 'NEW_YORK';
}

/**
 * Updates metrics inside account_statistics table
 */
async function updateAccountStats(accountId: string, supabase: any) {
  try {
    // 1. Fetch closed trades
    const { data: trades, error } = await supabase
      .from('trades')
      .select('pnl, entry_price, stop_loss, take_profit, open_time')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED');

    if (error || !trades) return;

    const totalTrades = trades.length;
    if (totalTrades === 0) return;

    const wins = trades.filter((t: any) => Number(t.pnl) > 0).length;
    const winRate = (wins / totalTrades) * 100;
    const netProfit = trades.reduce((sum: number, t: any) => sum + Number(t.pnl || 0), 0);
    
    // Calculate unique days traded
    const uniqueDays = new Set(trades.map((t: any) => t.open_time.split('T')[0]));
    const daysTraded = uniqueDays.size;

    // Calculate average Risk-to-Reward
    let rrSum = 0;
    let rrCount = 0;
    trades.forEach((t: any) => {
      if (t.entry_price && t.stop_loss && t.take_profit) {
        const risk = Math.abs(t.entry_price - t.stop_loss);
        const reward = Math.abs(t.take_profit - t.entry_price);
        if (risk > 0) {
          rrSum += reward / risk;
          rrCount++;
        }
      }
    });
    const avgRR = rrCount > 0 ? rrSum / rrCount : 0;

    // Upsert statistics
    await supabase
      .from('account_statistics')
      .upsert({
        account_id: accountId,
        total_trades: totalTrades,
        win_rate: winRate,
        net_profit: netProfit,
        avg_rr: avgRR,
        days_traded: daysTraded,
        last_updated: new Date().toISOString()
      }, { onConflict: 'account_id' });

  } catch (err) {
    console.error('Failed to update stats:', err);
  }
}
