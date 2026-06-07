import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';
import { runMultiAgentOrchestrator } from '@/lib/agents/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      accountId, 
      reportType = 'DAILY', 
      trades: clientTrades, 
      reflections: clientReflections, 
      profile: clientProfile,
      apiKey // BYOK user API key
    } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');

    // 1. Mock Mode Fallback (Processes data supplied directly by frontend state)
    if (isMock) {
      const balance = body.balance || 5000;
      const trades = clientTrades || [];
      const reflections = clientReflections || [];
      const profile = clientProfile || null;

      const report = await runMultiAgentOrchestrator(balance, trades, reflections, profile, reportType, apiKey);
      
      return NextResponse.json({
        success: true,
        isMockMode: true,
        report
      });
    }

    // 2. Production Supabase flow
    const user = await getUserFromSession(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: account, error: accError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accError || !account) {
      return NextResponse.json({ error: 'Trading account not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('prop_firm_profiles')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    const { data: trades } = await supabase
      .from('trades')
      .select('*')
      .eq('account_id', accountId)
      .order('open_time', { ascending: false });

    const { data: reflections } = await supabase
      .from('daily_reflections')
      .select('*')
      .eq('user_id', user.id)
      .order('reflection_date', { ascending: false })
      .limit(15);

    // 3. Execute Multi-Agent Orchestration with Gemini Key
    const report = await runMultiAgentOrchestrator(
      account.balance,
      trades || [],
      reflections || [],
      profile || null,
      reportType,
      apiKey
    );

    // 4. Cache coaching report in Database
    const { error: insertError } = await supabase
      .from('coaching_reports')
      .insert([{
        user_id: user.id,
        account_id: accountId,
        report_type: reportType,
        risk_data: report.risk,
        psychology_data: report.psychology,
        strategy_data: report.strategy,
        performance_data: report.performance,
        prop_firm_data: report.propFirm,
        blowup_prediction: report.blowup,
        executive_summary: report.coachReport.executiveSummary,
        action_plan: report.coachReport.actionPlan,
        full_report_markdown: report.coachReport.fullReportMarkdown
      }]);

    if (insertError) {
      console.error('Database write error caching Multi-Agent Report:', insertError);
    }

    return NextResponse.json({
      success: true,
      report
    });

  } catch (err: any) {
    console.error('Multi-Agent API Route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
