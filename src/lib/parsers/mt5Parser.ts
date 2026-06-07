import { TradeDirection } from '@/types';

export interface ParsedTrade {
  external_ticket: string;
  pair: string;
  direction: TradeDirection;
  entry_price: number;
  exit_price: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  pnl: number;
  commission: number;
  swap: number;
  open_time: string;
  close_time: string;
  duration_seconds: number;
}

/**
 * Normalizes trading asset symbols (e.g. "XAUUSD.pro" or "EURUSDm" -> "XAUUSD" or "EURUSD")
 */
function normalizeSymbol(symbol: string): string {
  if (!symbol) return 'UNKNOWN';
  
  // Remove suffix tags (e.g. .pro, .m, .ecn, etc.)
  let clean = symbol.toUpperCase().trim();
  clean = clean.split('.')[0]; // remove ".pro"
  clean = clean.replace(/[^A-Z0-9]/g, '');
  
  // Strip trailing letters if it results in standard 6-character forex or 6-character gold
  if (clean.length > 6 && (clean.startsWith('EUR') || clean.startsWith('GBP') || clean.startsWith('USD') || clean.startsWith('AUD') || clean.startsWith('NZD') || clean.startsWith('CAD') || clean.startsWith('CHF') || clean.startsWith('XAU') || clean.startsWith('XAG'))) {
    clean = clean.slice(0, 6);
  }
  
  return clean;
}

/**
 * Parses MT5 HTML Statement
 */
export function parseMT5Html(htmlContent: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  
  // Regex to extract table rows (tr) from HTML content
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  // Regex to strip HTML tags to get raw cell values
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let trMatch;
  let isClosedPositionsSection = false;
  
  while ((trMatch = trRegex.exec(htmlContent)) !== null) {
    const rowHtml = trMatch[1];
    
    // Check section header inside report
    if (rowHtml.toLowerCase().includes('closed positions') || rowHtml.toLowerCase().includes('positions')) {
      isClosedPositionsSection = true;
      continue;
    }
    
    // If we reach orders or deals list, end of closed positions
    if (isClosedPositionsSection && (rowHtml.toLowerCase().includes('orders') || rowHtml.toLowerCase().includes('deals') || rowHtml.toLowerCase().includes('working orders'))) {
      // Do not stop immediately, as some reports have "Positions" and then deals. But let's check for standard indicators.
    }

    if (!isClosedPositionsSection) continue;

    // Extract all cell values
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      // Clean HTML tags and entities inside cells
      const cleanVal = tdMatch[1]
        .replace(/<[^>]*>/g, '') // remove inner HTML tags (e.g. span)
        .replace(/&nbsp;/g, ' ')
        .trim();
      cells.push(cleanVal);
    }

    // A valid closed trade position row in MT5 standard HTML reports typically has 13-15 columns
    // Headers: Time | Position | Symbol | Action | Size | Price | S / L | T / P | Time | Price | Commission | Swap | Profit
    // Action column determines direction: "buy" or "sell"
    if (cells.length >= 13) {
      const openTime = cells[0];
      const ticket = cells[1];
      const symbol = cells[2];
      const action = cells[3]; // buy / sell
      const sizeStr = cells[4];
      const openPriceStr = cells[5];
      const slStr = cells[6];
      const tpStr = cells[7];
      const closeTime = cells[8];
      const closePriceStr = cells[9];
      const commissionStr = cells[10];
      const swapStr = cells[11];
      const profitStr = cells[12];

      // Validate that this is a trade entry row, checking date formats and numeric indicators
      const isDate = (str: string) => /^\d{4}[\.-]\d{2}[\.-]\d{2}/.test(str);
      const isNumeric = (str: string) => !isNaN(parseFloat(str.replace(/\s/g, '').replace(/,/g, '')));

      if (isDate(openTime) && isDate(closeTime) && isNumeric(ticket) && isNumeric(sizeStr)) {
        const pnl = parseFloat(profitStr.replace(/\s/g, '').replace(/,/g, ''));
        const commission = parseFloat(commissionStr.replace(/\s/g, '').replace(/,/g, '')) || 0;
        const swap = parseFloat(swapStr.replace(/\s/g, '').replace(/,/g, '')) || 0;
        const lotSize = parseFloat(sizeStr.replace(/\s/g, '').replace(/,/g, ''));
        const entryPrice = parseFloat(openPriceStr.replace(/\s/g, '').replace(/,/g, ''));
        const exitPrice = parseFloat(closePriceStr.replace(/\s/g, '').replace(/,/g, ''));
        const stopLoss = parseFloat(slStr.replace(/\s/g, '').replace(/,/g, '')) || 0;
        const takeProfit = parseFloat(tpStr.replace(/\s/g, '').replace(/,/g, '')) || 0;
        
        const direction: TradeDirection = action.toUpperCase().includes('BUY') ? 'LONG' : 'SHORT';
        
        // Normalize Dates
        const parsedOpen = new Date(openTime.replace(/\./g, '/')).toISOString();
        const parsedClose = new Date(closeTime.replace(/\./g, '/')).toISOString();
        const durationSeconds = Math.max(Math.floor((new Date(parsedClose).getTime() - new Date(parsedOpen).getTime()) / 1000), 0);

        trades.push({
          external_ticket: ticket,
          pair: normalizeSymbol(symbol),
          direction,
          entry_price: entryPrice,
          exit_price: exitPrice,
          stop_loss: stopLoss,
          take_profit: takeProfit,
          lot_size: lotSize,
          pnl,
          commission,
          swap,
          open_time: parsedOpen,
          close_time: parsedClose,
          duration_seconds: durationSeconds
        });
      }
    }
  }

  return trades;
}

/**
 * Parses MT5 CSV Statement
 */
export function parseMT5Csv(csvContent: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  const lines = csvContent.split(/\r?\n/);
  
  if (lines.length < 2) return [];

  // Identify separator (comma or semicolon or tab)
  let separator = ',';
  const firstLine = lines[0];
  if (firstLine.includes(';')) separator = ';';
  else if (firstLine.includes('\t')) separator = '\t';

  // Find Headers index
  // MT5 CSV exports may vary. Example columns:
  // Ticket,Type,Volume,Symbol,Open Time,Open Price,S/L,T/P,Close Time,Close Price,Commission,Swap,Profit
  const headers = firstLine.split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase());
  
  const ticketIdx = headers.findIndex(h => h.includes('ticket') || h.includes('position'));
  const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('action') || h.includes('direction'));
  const volumeIdx = headers.findIndex(h => h.includes('volume') || h.includes('size') || h.includes('lots'));
  const symbolIdx = headers.findIndex(h => h.includes('symbol') || h.includes('pair') || h.includes('item'));
  const openTimeIdx = headers.findIndex(h => h.includes('open time') || h.includes('time') && !h.includes('close'));
  const openPriceIdx = headers.findIndex(h => h.includes('open price') || h.includes('price') && !h.includes('close') && !h.includes('sl') && !h.includes('tp'));
  const slIdx = headers.findIndex(h => h.includes('s/l') || h.includes('sl') || h.includes('stop loss'));
  const tpIdx = headers.findIndex(h => h.includes('t/p') || h.includes('tp') || h.includes('take profit'));
  const closeTimeIdx = headers.findIndex(h => h.includes('close time') || h.includes('time') && h.includes('close'));
  const closePriceIdx = headers.findIndex(h => h.includes('close price') || h.includes('price') && h.includes('close'));
  const commissionIdx = headers.findIndex(h => h.includes('commission') || h.includes('fee'));
  const swapIdx = headers.findIndex(h => h.includes('swap'));
  const profitIdx = headers.findIndex(h => h.includes('profit') || h.includes('pnl'));

  // Ensure mandatory indexes are found
  if (ticketIdx === -1 || symbolIdx === -1 || openTimeIdx === -1 || openPriceIdx === -1 || profitIdx === -1) {
    // If standard header matching fails, try to fallback to default index positions
    return parseMT5CsvFallback(lines, separator);
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split(separator).map(c => c.replace(/"/g, '').trim());
    if (cells.length < Math.max(ticketIdx, symbolIdx, openTimeIdx, openPriceIdx, profitIdx)) continue;

    const ticket = cells[ticketIdx];
    const symbol = cells[symbolIdx];
    const type = cells[typeIdx]?.toUpperCase() || 'BUY';
    const volume = cells[volumeIdx];
    const openPrice = cells[openPriceIdx];
    const sl = slIdx !== -1 ? cells[slIdx] : '0';
    const tp = tpIdx !== -1 ? cells[tpIdx] : '0';
    const closeTime = closeTimeIdx !== -1 ? cells[closeTimeIdx] : '';
    const closePrice = closePriceIdx !== -1 ? cells[closePriceIdx] : '0';
    const commission = commissionIdx !== -1 ? cells[commissionIdx] : '0';
    const swap = swapIdx !== -1 ? cells[swapIdx] : '0';
    const profit = cells[profitIdx];

    const isNumeric = (str: string) => !isNaN(parseFloat(str));
    
    if (ticket && isNumeric(ticket) && isNumeric(volume) && isNumeric(openPrice) && isNumeric(profit)) {
      const pnl = parseFloat(profit);
      const comVal = parseFloat(commission) || 0;
      const swapVal = parseFloat(swap) || 0;
      const lotSize = parseFloat(volume);
      const entryPrice = parseFloat(openPrice);
      const exitPrice = parseFloat(closePrice);
      const stopLoss = parseFloat(sl) || 0;
      const takeProfit = parseFloat(tp) || 0;

      const direction: TradeDirection = type.includes('SELL') || type.includes('SHORT') ? 'SHORT' : 'LONG';
      
      const parsedOpen = new Date(cells[openTimeIdx]).toISOString();
      const parsedClose = closeTime ? new Date(closeTime).toISOString() : new Date().toISOString();
      const durationSeconds = Math.max(Math.floor((new Date(parsedClose).getTime() - new Date(parsedOpen).getTime()) / 1000), 0);

      trades.push({
        external_ticket: ticket,
        pair: normalizeSymbol(symbol),
        direction,
        entry_price: entryPrice,
        exit_price: exitPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        lot_size: lotSize,
        pnl,
        commission: comVal,
        swap: swapVal,
        open_time: parsedOpen,
        close_time: parsedClose,
        duration_seconds: durationSeconds
      });
    }
  }

  return trades;
}

/**
 * Fallback parser when header column labels mismatch
 */
function parseMT5CsvFallback(lines: string[], separator: string): ParsedTrade[] {
  const trades: ParsedTrade[] = [];
  
  // Loop skipping headers
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = line.split(separator).map(c => c.replace(/"/g, '').trim());
    if (cells.length < 9) continue; // Must contain minimal fields

    const ticket = cells[0];
    const type = cells[1]?.toUpperCase() || '';
    const volume = cells[2];
    const symbol = cells[3];
    const openPrice = cells[4];
    const sl = cells[5] || '0';
    const tp = cells[6] || '0';
    const openTime = cells[7];
    const exitPrice = cells[8] || '0';
    const closeTime = cells[9] || '';
    const profit = cells[cells.length - 1]; // profit is usually last

    const isNumeric = (str: string) => !isNaN(parseFloat(str));

    if (ticket && isNumeric(ticket) && isNumeric(volume) && isNumeric(openPrice) && isNumeric(profit)) {
      const pnl = parseFloat(profit);
      const lotSize = parseFloat(volume);
      const entryPrice = parseFloat(openPrice);
      const exitPriceVal = parseFloat(exitPrice);
      const stopLoss = parseFloat(sl) || 0;
      const takeProfit = parseFloat(tp) || 0;

      const direction: TradeDirection = type.includes('SELL') ? 'SHORT' : 'LONG';
      const parsedOpen = new Date(openTime).toISOString();
      const parsedClose = closeTime ? new Date(closeTime).toISOString() : new Date().toISOString();
      const durationSeconds = Math.max(Math.floor((new Date(parsedClose).getTime() - new Date(parsedOpen).getTime()) / 1000), 0);

      trades.push({
        external_ticket: ticket,
        pair: normalizeSymbol(symbol),
        direction,
        entry_price: entryPrice,
        exit_price: exitPriceVal,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        lot_size: lotSize,
        pnl,
        commission: 0,
        swap: 0,
        open_time: parsedOpen,
        close_time: parsedClose,
        duration_seconds: durationSeconds
      });
    }
  }

  return trades;
}
