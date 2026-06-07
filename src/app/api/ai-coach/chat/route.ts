import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';
import { getCoachResponse, analyzeTradingDNA } from '@/lib/coach';
import { callGeminiChat } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { message, accountId, chatHistory, apiKey, trades: reqTrades, reflections: reqReflections } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
    const activeKey = apiKey || process.env.GEMINI_API_KEY;

    // 1. Gather Local Context (used for both mock & real flows)
    let trades: any[] = reqTrades || [];
    let reflections: any[] = reqReflections || [];
    let userId = 'demo-user';

    if (!isMock) {
      const user = await getUserFromSession(request);
      if (user) {
        userId = user.id;
        const supabase = createAdminClient();
        const { data: tradesData } = await supabase
          .from('trades')
          .select('*')
          .eq('account_id', accountId);
        if (tradesData && tradesData.length > 0) {
          trades = tradesData;
        }

        const { data: reflectionsData } = await supabase
          .from('daily_reflections')
          .select('*')
          .eq('user_id', user.id);
        if (reflectionsData && reflectionsData.length > 0) {
          reflections = reflectionsData;
        }
      }
    }

    // 2. Mock Fallback when API key is missing entirely
    if (!activeKey) {
      const lowerMsg = message.toLowerCase();
      let responseKey = 'default';
      
      if (lowerMsg.includes('lose') || lowerMsg.includes('loss') || lowerMsg.includes('losing') || lowerMsg.includes('why')) {
        responseKey = 'why_am_i_losing';
      } else if (lowerMsg.includes('overtrade') || lowerMsg.includes('frequency') || lowerMsg.includes('many')) {
        responseKey = 'am_i_overtrading';
      } else if (lowerMsg.includes('weak') || lowerMsg.includes('flaw') || lowerMsg.includes('psychology') || lowerMsg.includes('mistake')) {
        responseKey = 'what_is_my_biggest_weakness';
      } else if (lowerMsg.includes('best') || lowerMsg.includes('perform') || lowerMsg.includes('win') || lowerMsg.includes('setup')) {
        responseKey = 'which_setup_performs_best';
      }

      if (trades.length === 0 && typeof window !== 'undefined') {
        const data = localStorage.getItem('trader_dna_trades');
        trades = data ? JSON.parse(data) : [];
        const refData = localStorage.getItem('trader_dna_reflections');
        reflections = refData ? JSON.parse(refData) : [];
      }

      const reply = getCoachResponse(responseKey, trades, reflections);

      await new Promise(resolve => setTimeout(resolve, 1000));
      return NextResponse.json({
        success: true,
        isMockMode: true,
        reply
      });
    }

    // 3. Real RAG Flow with pgvector (checks dimensions matches 1536)
    let matchedNotesContext = 'No semantically matching past journal logs found.';

    if (!isMock) {
      const supabase = createAdminClient();
      try {
        const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${activeKey}`;
        const embedResponse = await fetch(embedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: message }] }
          })
        });

        if (embedResponse.ok) {
          const embeddingData = await embedResponse.json();
          const queryVector = embeddingData.embedding?.values || [];

          // Only call RPC vector search if dimensions match the database vector(1536) structure
          if (queryVector.length === 1536) {
            const { data: matchedNotes, error: rpcError } = await supabase.rpc('match_trade_notes', {
              query_embedding: queryVector,
              match_threshold: 0.2,
              match_count: 5,
              p_user_id: userId
            });

            if (!rpcError && matchedNotes && matchedNotes.length > 0) {
              matchedNotesContext = matchedNotes
                .map((n: any) => `- Trade ID: ${n.trade_id}, Note Summary: "${n.notes_summary}" (Similarity: ${Math.round(n.similarity * 100)}%)`)
                .join('\n');
            }
          } else {
            console.warn(`Gemini text-embedding-004 returned ${queryVector.length} dimensions. Vector search skipped to avoid DB constraints error.`);
          }
        }
      } catch (embedErr) {
        console.warn('Embedding search failed:', embedErr);
      }
    } else {
      // Mock/Offline DB: construct context from the provided trades/reflections
      const recentTradesWithNotes = trades
        .filter((t: any) => t.notes)
        .slice(0, 10);
      const recentReflections = reflections
        .filter((r: any) => r.overall_notes || r.lessons_learned)
        .slice(0, 10);
      
      if (recentTradesWithNotes.length > 0 || recentReflections.length > 0) {
        matchedNotesContext = [
          ...recentTradesWithNotes.map((t: any) => `- Trade ${t.pair} (${t.direction}): "${t.notes}"`),
          ...recentReflections.map((r: any) => `- Reflection: Focus score ${r.focus_score}/10, overall notes: "${r.overall_notes}", lessons learned: "${r.lessons_learned}"`)
        ].join('\n');
      }
    }

    // 4. Analyze DNA Statistics
    const dna = analyzeTradingDNA(trades);
    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    const winRate = dna.winRate;

    // 5. Invoke Google Gemini Chat API
    const systemInstruction = `You are an elite AI Trading Mentor and Cognitive Coach.
Your goal is to help the trader identify psychological patterns, execution flaws, and improve profitability.
Use the supplied statistics and semantically matched journal extracts to customize your response.
Be direct, professional, and act like a real mentor. Avoid generic platitudes; quote their specific logs if helpful.

Trader DNA Statistics:
- Account Win Rate: ${winRate.toFixed(1)}% over ${closedTrades.length} trades.
- Top Asset: ${dna.bestPair} (Worst Asset: ${dna.worstPair})
- Best Session: ${dna.bestSession} (Worst Session: ${dna.worstSession})
- Top Strategy: ${dna.bestStrategy} (Worst Strategy: ${dna.worstStrategy})
- Streak/Vulnerabilities: User loses most when: ${dna.losesMostWhen.join(', ')}

Relevant Semantic Journal Memory:
${matchedNotesContext}`;

    const formattedContents = [
      ...(chatHistory || []).map((msg: any) => ({
        role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    try {
      const reply = await callGeminiChat(formattedContents, systemInstruction, activeKey);

      return NextResponse.json({
        success: true,
        reply
      });
    } catch (apiErr: any) {
      console.warn('Gemini chat failed, falling back to local heuristic mentor engine:', apiErr);
      
      const lowerMsg = message.toLowerCase();
      let responseKey = 'default';
      
      if (lowerMsg.includes('lose') || lowerMsg.includes('loss') || lowerMsg.includes('losing') || lowerMsg.includes('why')) {
        responseKey = 'why_am_i_losing';
      } else if (lowerMsg.includes('overtrade') || lowerMsg.includes('frequency') || lowerMsg.includes('many')) {
        responseKey = 'am_i_overtrading';
      } else if (lowerMsg.includes('weak') || lowerMsg.includes('flaw') || lowerMsg.includes('psychology') || lowerMsg.includes('mistake')) {
        responseKey = 'what_is_my_biggest_weakness';
      } else if (lowerMsg.includes('best') || lowerMsg.includes('perform') || lowerMsg.includes('win') || lowerMsg.includes('setup')) {
        responseKey = 'which_setup_performs_best';
      }

      const fallbackReply = getCoachResponse(responseKey, trades, reflections);
      const isConnectionIssue = apiErr.message?.includes('API connection error') || apiErr.message?.includes('is not found');
      const warningHeader = isConnectionIssue
        ? `*⚠️ Note: There is an issue with your Gemini API key activation or model permissions (${apiErr.message || 'Not Found'}). Running in local heuristic analyzer mode:* \n\n`
        : `*⚠️ Local Fallback Mode activated:* \n\n`;

      return NextResponse.json({
        success: true,
        isMockMode: true,
        reply: warningHeader + fallbackReply
      });
    }
  } catch (err: any) {
    console.error('AI Coach Chat API error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
