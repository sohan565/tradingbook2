//+------------------------------------------------------------------+
//|                                             TradingBookSync.mq5  |
//|                                  Copyright 2026, TradingBook     |
//|                                       https://localhost:3000     |
//|                                                                  |
//|  Directions to run:                                             |
//|  1. Open MetaEditor inside MT5 (F4).                             |
//|  2. Create a new Expert Advisor, paste this code, and compile.    |
//|  3. In MT5 terminal, go to Tools -> Options -> Expert Advisors.  |
//|     Check "Allow WebRequest for listed URL" and add:            |
//|     http://localhost:3000 (or your server domain)               |
//|  4. Drag the EA onto any chart and enter your API Key.           |
//+------------------------------------------------------------------+
#property copyright "TradingBook"
#property link      "https://localhost:3000"
#property version   "1.00"
#property description "Synchronizes MT5 trade history to your TradingBook Web Journal."

//--- Input Parameters
input string   InpWebhookURL = "http://localhost:3000/api/webhooks/mt5"; // Webhook URL
input string   InpAPIKey     = "";                                       // secure API Key
input int      InpSyncDays   = 30;                                       // Initial history sync (days)
input int      InpTimerSec   = 10;                                       // Check interval (seconds)

//--- Global Variables
datetime g_last_sync_time = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("TradingBook Sync: Initializing Expert Advisor...");

   if(StringLen(InpAPIKey) == 0)
   {
      Alert("TradingBook Error: API Key input parameter is empty!");
      return(INIT_PARAMETERS_INCORRECT);
   }

   // Set timer for periodic sync checks
   EventSetTimer(InpTimerSec);

   // Perform initial sync on launch
   g_last_sync_time = TimeCurrent() - (InpSyncDays * 24 * 3600);
   SyncHistory();

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("TradingBook Sync: Deinitialized.");
}

//+------------------------------------------------------------------+
//| Timer event function                                             |
//+------------------------------------------------------------------+
void OnTimer()
{
   SyncHistory();
}

//+------------------------------------------------------------------+
//| Event on Trade transaction                                       |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
{
   // If a deal occurred, trigger a sync update immediately
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      Print("TradingBook Sync: Trade transaction detected! Syncing...");
      SyncHistory();
   }
}

//+------------------------------------------------------------------+
//| Core History Sync Function                                       |
//+------------------------------------------------------------------+
void SyncHistory()
{
   datetime now = TimeCurrent();
   
   // Select history deals list
   if(!HistorySelect(g_last_sync_time, now))
   {
      Print("TradingBook Sync: HistorySelect failed.");
      return;
   }

   int total_deals = HistoryDealsTotal();
   int synced_count = 0;
   
   // Loop through all deals in selected window
   for(int i = 0; i < total_deals; i++)
   {
      ulong deal_ticket = HistoryDealGetTicket(i);
      if(deal_ticket == 0) continue;

      // We only care about deals that close a position (DEAL_ENTRY_OUT or DEAL_ENTRY_INOUT)
      long entry_type = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
      if(entry_type != DEAL_ENTRY_OUT && entry_type != DEAL_ENTRY_INOUT) continue;

      ulong position_id = HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
      double pnl = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
      double swap = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
      double commission = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
      double exit_price = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
      datetime exit_time = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
      double volume = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
      string symbol = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
      long magic = HistoryDealGetInteger(deal_ticket, DEAL_MAGIC);
      string comment = HistoryDealGetString(deal_ticket, DEAL_COMMENT);

      // Find the entry details (DEAL_ENTRY_IN) for this Position ID
      double entry_price = 0;
      datetime entry_time = 0;
      long deal_type = 0; // Buy or Sell

      if(HistorySelectByPosition(position_id))
      {
         int pos_deals = HistoryDealsTotal();
         for(int j = 0; j < pos_deals; j++)
         {
            ulong p_deal = HistoryDealGetTicket(j);
            if(p_deal == 0) continue;
            
            long p_entry = HistoryDealGetInteger(p_deal, DEAL_ENTRY);
            if(p_entry == DEAL_ENTRY_IN)
            {
               entry_price = HistoryDealGetDouble(p_deal, DEAL_PRICE);
               entry_time = (datetime)HistoryDealGetInteger(p_deal, DEAL_TIME);
               deal_type = HistoryDealGetInteger(p_deal, DEAL_TYPE);
               break;
            }
         }
      }

      // Default fallback if opening deal wasn't selected
      if(entry_price == 0)
      {
         entry_price = exit_price;
         entry_time = exit_time;
      }

      // Format JSON string manually (escape characters handled)
      string type_str = (deal_type == DEAL_TYPE_BUY) ? "BUY" : "SELL";
      
      // Clean comment to avoid JSON syntax breaking
      string clean_comment = comment;
      StringReplace(clean_comment, "\"", "'");

      // Calculate simple pips representation (diff / Point)
      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      double pips = 0;
      if(point > 0)
      {
         double diff = (type_str == "BUY") ? (exit_price - entry_price) : (entry_price - exit_price);
         // For Gold/FX standard pips
         double digits = SymbolInfoInteger(symbol, SYMBOL_DIGITS);
         double pip_multiplier = (digits == 3 || digits == 5) ? 10 : 1;
         pips = diff / (point * pip_multiplier);
      }

      string json = StringFormat(
         "{\"accountNumber\":\"%d\",\"ticket\":%d,\"symbol\":\"%s\",\"type\":\"%s\",\"lotSize\":%.2f,\"entryPrice\":%.5f,\"entryTime\":%d,\"exitPrice\":%.5f,\"exitTime\":%d,\"pnl\":%.2f,\"pnlPips\":%.1f,\"commission\":%.2f,\"swap\":%.2f,\"status\":\"closed\",\"magicNumber\":%d,\"comment\":\"%s\"}",
         AccountNumber(),
         position_id, // Use unique position ID as ticket identifier
         symbol,
         type_str,
         volume,
         entry_price,
         (int)entry_time,
         exit_price,
         (int)exit_time,
         pnl,
         pips,
         commission,
         swap,
         magic,
         clean_comment
      );

      // Send to Web Journal
      if(SendWebhook(json))
      {
         synced_count++;
      }
   }

   if(synced_count > 0)
   {
      PrintFormat("TradingBook Sync: Successfully synced %d trades to the database.", synced_count);
   }

   // Update sliding window check pointer
   g_last_sync_time = now - 5; // offset slightly to prevent boundary overlaps
}

//+------------------------------------------------------------------+
//| WebRequest Webhook sender helper                                 |
//+------------------------------------------------------------------+
bool SendWebhook(string json_payload)
{
   char post_data[];
   char result_data[];
   string result_headers;
   
   StringToCharArray(json_payload, post_data, 0, WHOLE_ARRAY, CP_UTF8);
   
   // Configure headers
   string headers = StringFormat("Content-Type: application/json\r\nX-Api-Key: %s\r\n", InpAPIKey);
   
   // WebRequest timeout
   int timeout = 5000;
   
   ResetLastError();
   int response_code = WebRequest("POST", InpWebhookURL, headers, timeout, post_data, result_data, result_headers);
   
   if(response_code == -1)
   {
      int err = GetLastError();
      PrintFormat("TradingBook WebRequest Error: #%d. Make sure the URL '%s' is added to Tools -> Options -> Expert Advisors.", err, InpWebhookURL);
      return false;
   }
   
   if(response_code != 200 && response_code != 201)
   {
      string response_body = CharArrayToString(result_data, CP_UTF8);
      PrintFormat("TradingBook Webhook HTTP Error %d: %s", response_code, response_body);
      return false;
   }

   return true;
}
//+------------------------------------------------------------------+
