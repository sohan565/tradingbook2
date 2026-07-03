import pandas as pd
import numpy as np
import threading
import time
import json
import os
import sys
import argparse
import urllib.request
import urllib.error
import tkinter as tk
from tkinter import filedialog, ttk, messagebox
from datetime import datetime
from lightweight_charts import Chart

# Symbol configuration matching Next.js trade-math.ts
SYMBOLS = {
    'XAUUSD': {'name': 'XAU/USD', 'pip_size': 0.01, 'pip_value': 1.0, 'digits': 2},
    'EURUSD': {'name': 'EUR/USD', 'pip_size': 0.0001, 'pip_value': 10.0, 'digits': 5},
    'GBPUSD': {'name': 'GBP/USD', 'pip_size': 0.0001, 'pip_value': 10.0, 'digits': 5},
    'USDJPY': {'name': 'USD/JPY', 'pip_size': 0.01, 'pip_value': 6.35, 'digits': 3},
    'BTCUSD': {'name': 'BTC/USD', 'pip_size': 1.0, 'pip_value': 1.0, 'digits': 2},
    'ETHUSD': {'name': 'ETH/USD', 'pip_size': 0.01, 'pip_value': 1.0, 'digits': 2},
    'NAS100': {'name': 'NAS100', 'pip_size': 0.01, 'pip_value': 1.0, 'digits': 2},
}

CSV_TIMEZONES = [
    ('UTC-12', -720),
    ('UTC-11', -660),
    ('UTC-10', -600),
    ('UTC-9', -540),
    ('UTC-8 (PST)', -480),
    ('UTC-7 (MST)', -420),
    ('UTC-6 (CST)', -360),
    ('UTC-5 (EST)', -300),
    ('UTC-4 (EDT/New York)', -240),
    ('UTC-3', -180),
    ('UTC-2', -120),
    ('UTC-1', -60),
    ('UTC', 0),
    ('UTC+1 (CET)', 60),
    ('UTC+2 (EET)', 120),
    ('UTC+3 (MSK)', 180),
    ('UTC+4', 240),
    ('UTC+5', 300),
    ('UTC+5:30 (IST - India)', 330),
    ('UTC+6', 360),
    ('UTC+7', 420),
    ('UTC+8 (SGT/AWST)', 480),
    ('UTC+9 (JST)', 540),
    ('UTC+9:30 (ACST)', 570),
    ('UTC+10 (AEST)', 600),
    ('UTC+11', 660),
    ('UTC+12', 720),
]

def get_symbol_config(symbol):
    return SYMBOLS.get(symbol, SYMBOLS['XAUUSD'])

class BacktesterApp:
    def __init__(self, csv_path, symbol="XAUUSD", timeframe="15m", initial_balance=10000.0, lot_size=1.0, session_id=None, tz_offset=0):
        self.csv_path = csv_path
        self.symbol = symbol
        self.timeframe = timeframe
        self.initial_balance = float(initial_balance)
        self.balance = float(initial_balance)
        self.lot_size = float(lot_size)
        self.session_id = session_id
        self.tz_offset = int(tz_offset)
        
        # State variables
        self.is_playing = False
        self.speed = 0.5  # Seconds between candles
        self.current_index = 0
        self.initial_bars_count = 100
        
        # Positions and Trades
        # Single active position: {'type': 'BUY'/'SELL', 'entry_price': float, 'lot_size': float, 'entry_time': str, 'line': HorizontalLine}
        self.open_position = None
        self.closed_trades = []
        
        # Load and process data
        print(f"Loading data from {self.csv_path}...")
        self.raw_df = self.load_csv(self.csv_path)
        print(f"Loaded {len(self.raw_df)} M1 rows.")
        
        self.df = self.aggregate_data(self.raw_df, self.timeframe)
        print(f"Aggregated into {len(self.df)} '{self.timeframe}' bars.")
        
        if len(self.df) == 0:
            raise ValueError("No bars available after aggregation. Check the data range.")
            
        self.current_index = min(self.initial_bars_count, len(self.df) - 1)
        
        # Chart initialization
        self.chart = None
        self.entry_price_line = None
        
    def load_csv(self, path):
        """Parse raw CSV files supporting MT5 export or HistData format without headers."""
        # Try reading first few rows to detect format and headers
        first_rows = pd.read_csv(path, nrows=5)
        has_header = False
        try:
            # Check if column 2 is numeric, if not, it's likely a header
            float(first_rows.iloc[0, 2])
        except Exception:
            has_header = True
            
        if has_header:
            df = pd.read_csv(path)
            df.columns = [c.lower().strip() for c in df.columns]
            if 'date' in df.columns and 'time' in df.columns:
                df['time'] = pd.to_datetime(df['date'].astype(str) + ' ' + df['time'].astype(str))
                df = df.drop(columns=['date'])
            elif 'time' in df.columns:
                df['time'] = pd.to_datetime(df['time'])
            elif 'date' in df.columns:
                df['time'] = pd.to_datetime(df['date'])
                df = df.drop(columns=['date'])
        else:
            df = pd.read_csv(path, header=None)
            if len(df.columns) >= 7:
                # MT5 format: Date, Time, Open, High, Low, Close, Volume
                df.columns = ['date_part', 'time_part', 'open', 'high', 'low', 'close', 'volume'] + list(df.columns[7:])
                df['time'] = pd.to_datetime(df['date_part'].astype(str) + ' ' + df['time_part'].astype(str))
                df = df.drop(columns=['date_part', 'time_part'])
            elif len(df.columns) == 6:
                df.columns = ['time', 'open', 'high', 'low', 'close', 'volume']
                df['time'] = pd.to_datetime(df['time'])
            else:
                raise ValueError("Unsupported CSV structure. Requires at least 6 columns (Time, Open, High, Low, Close, Volume).")
        
        # Cleanup
        df = df.dropna(subset=['open', 'high', 'low', 'close'])
        # Rename columns to standardized names
        df = df.rename(columns={'volume': 'volume'})
        df['open'] = df['open'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)
        df['close'] = df['close'].astype(float)
        if 'volume' in df.columns:
            df['volume'] = df['volume'].astype(float)
        else:
            df['volume'] = 0.0
            
        df = df.sort_values('time').reset_index(drop=True)
        if self.tz_offset != 0:
            df['time'] = df['time'] - pd.to_timedelta(self.tz_offset, unit='m')
        return df[['time', 'open', 'high', 'low', 'close', 'volume']]
        
    def aggregate_data(self, df, timeframe):
        """Aggregate raw M1 candles into target timeframe using pandas resampling."""
        if timeframe == '1m':
            res = df.copy()
            res['time'] = res['time'].dt.strftime('%Y-%m-%d %H:%M:%S')
            return res
            
        tf_map = {
            '5m': '5min',
            '15m': '15min',
            '30m': '30min',
            '1H': '1h',
            '4H': '4h',
            '1D': '1D'
        }
        freq = tf_map.get(timeframe, '15min')
        
        resdf = df.set_index('time')
        aggregated = resdf.resample(freq).agg({
            'open': 'first',
            'high': 'max',
            'low': 'min',
            'close': 'last',
            'volume': 'sum'
        }).dropna()
        
        aggregated = aggregated.reset_index()
        # lightweight-charts-python requires time column to be formatted string or datetime
        aggregated['time'] = aggregated['time'].dt.strftime('%Y-%m-%d %H:%M:%S')
        return aggregated

    def start(self):
        """Build and show the interactive chart."""
        self.chart = Chart(toolbox=True)
        
        # Configure chart design matching TradingBook dark theme
        self.chart.layout(background_color='#080b12', text_color='#94a3b8', font_size=12)
        self.chart.grid(vert_enabled=True, horz_enabled=True, color='#111827')
        self.chart.candle_style(up_color='#10b981', down_color='#ef4444', border_up_color='#10b981', border_down_color='#ef4444', wick_up_color='#10b981', wick_down_color='#ef4444')
        self.chart.volume_config(up_color='rgba(16, 185, 129, 0.25)', down_color='rgba(239, 68, 68, 0.25)')
        
        # Initial chart load
        initial_df = self.df.iloc[:self.current_index + 1]
        self.chart.set(initial_df)
        
        # Set up top bar widgets
        self.chart.topbar.button('play_pause', '▶ Play', func=self.on_play_pause)
        self.chart.topbar.button('step', '⏭ Step', func=self.on_step)
        self.chart.topbar.switcher('speed', ('1/s', '2/s', '3/s', '4/s', '5/s'), default='2/s', func=self.on_speed_change)
        
        self.chart.topbar.button('buy', '🟢 BUY', func=self.on_buy)
        self.chart.topbar.button('sell', '🔴 SELL', func=self.on_sell)
        self.chart.topbar.button('close', '❌ CLOSE', func=self.on_close)
        self.chart.topbar.button('reset', '🔄 Reset', func=self.on_reset)
        
        timeframes = ('1m', '5m', '15m', '30m', '1H', '4H', '1D')
        self.chart.topbar.switcher('timeframe', timeframes, default=self.timeframe, func=self.on_timeframe_change)
        
        self.chart.topbar.textbox('stats', '')
        self.update_stats_display()
        
        # Start replay background loop thread
        self.loop_thread = threading.Thread(target=self.replay_loop, daemon=True)
        self.loop_thread.start()
        
        # Show chart window
        self.chart.show(block=True)
        
    def replay_loop(self):
        """Threaded playback loop for candle-by-candle replay."""
        while True:
            if not self.is_playing:
                time.sleep(0.1)
                continue
                
            if self.current_index >= len(self.df) - 1:
                self.is_playing = False
                self.chart.topbar['play_pause'].set('▶ Play')
                time.sleep(0.1)
                continue
                
            self.current_index += 1
            row = self.df.iloc[self.current_index]
            
            # Check for position close or updates
            self.check_position_live(row)
            
            # Push candle to chart
            self.chart.update(row)
            self.update_stats_display()
            
            # Sync session back to Next.js
            if self.session_id and self.current_index % 10 == 0:
                self.sync_to_nextjs()
                
            time.sleep(self.speed)

    def check_position_live(self, row):
        """Update active position details or check SL/TP triggers."""
        if not self.open_position:
            return
            
        # Optional: SL/TP triggers (if set via UI in the future)
        # For now, this updates live unrealized PnL
        pass

    def update_stats_display(self):
        """Calculate and display updated statistics in the topbar."""
        current_close = self.df.iloc[self.current_index]['close']
        
        # Calculate unrealized P&L
        unrealized_pnl = 0.0
        pos_desc = "None"
        if self.open_position:
            ptype = self.open_position['type']
            entry = self.open_position['entry_price']
            size = self.open_position['lot_size']
            
            config = get_symbol_config(self.symbol)
            diff = current_close - entry if ptype == 'BUY' else entry - current_close
            pips = diff / config['pip_size']
            unrealized_pnl = pips * config['pip_value'] * size
            pos_desc = f"{ptype} {size} lot @ {entry:.2f} (PnL: ${unrealized_pnl:+.2f})"
            
        equity = self.balance + unrealized_pnl
        net_return = ((equity - self.initial_balance) / self.initial_balance) * 100
        
        stats_str = f"Balance: ${self.balance:,.2f} | Equity: ${equity:,.2f} ({net_return:+.1f}%) | Pos: {pos_desc} | Closed Trades: {len(self.closed_trades)}"
        if self.chart:
            self.chart.topbar['stats'].set(stats_str)

    # ---------- Callbacks ----------
    
    def on_play_pause(self, chart):
        self.is_playing = not self.is_playing
        btn_text = '⏸ Pause' if self.is_playing else '▶ Play'
        self.chart.topbar['play_pause'].set(btn_text)
        
    def on_step(self, chart):
        self.is_playing = False
        self.chart.topbar['play_pause'].set('▶ Play')
        
        if self.current_index < len(self.df) - 1:
            self.current_index += 1
            row = self.df.iloc[self.current_index]
            self.check_position_live(row)
            self.chart.update(row)
            self.update_stats_display()
            self.sync_to_nextjs()

    def on_speed_change(self, chart):
        speed_str = self.chart.topbar['speed'].value
        speed_map = {
            '1/s': 1.0,
            '2/s': 0.5,
            '3/s': 0.333,
            '4/s': 0.25,
            '5/s': 0.20
        }
        self.speed = speed_map.get(speed_str, 0.5)

    def on_buy(self, chart):
        if self.open_position:
            print("[Backtester] Can only hold one position at a time.")
            return
            
        current_bar = self.df.iloc[self.current_index]
        price = current_bar['close']
        bar_time = current_bar['time']
        
        print(f"[Order] BUY 1.0 Lot @ {price}")
        
        # Draw horizontal entry line
        self.entry_price_line = self.chart.horizontal_line(price, color='#10b981')
        
        self.open_position = {
            'type': 'BUY',
            'entry_price': price,
            'lot_size': self.lot_size,
            'entry_time': bar_time
        }
        
        # Place Buy arrow marker
        self.chart.marker(
            time=bar_time,
            position='below',
            shape='arrow_up',
            color='#10b981',
            text=f"BUY {self.lot_size} Lot"
        )
        self.update_stats_display()
        self.sync_to_nextjs()

    def on_sell(self, chart):
        if self.open_position:
            print("[Backtester] Can only hold one position at a time.")
            return
            
        current_bar = self.df.iloc[self.current_index]
        price = current_bar['close']
        bar_time = current_bar['time']
        
        print(f"[Order] SELL 1.0 Lot @ {price}")
        
        # Draw horizontal entry line
        self.entry_price_line = self.chart.horizontal_line(price, color='#ef4444')
        
        self.open_position = {
            'type': 'SELL',
            'entry_price': price,
            'lot_size': self.lot_size,
            'entry_time': bar_time
        }
        
        # Place Sell arrow marker
        self.chart.marker(
            time=bar_time,
            position='above',
            shape='arrow_down',
            color='#ef4444',
            text=f"SELL {self.lot_size} Lot"
        )
        self.update_stats_display()
        self.sync_to_nextjs()

    def on_close(self, chart):
        if not self.open_position:
            print("[Backtester] No active position to close.")
            return
            
        current_bar = self.df.iloc[self.current_index]
        exit_price = current_bar['close']
        bar_time = current_bar['time']
        
        pos_type = self.open_position['type']
        entry_price = self.open_position['entry_price']
        entry_time = self.open_position['entry_time']
        size = self.open_position['lot_size']
        
        # Calculate P&L
        config = get_symbol_config(self.symbol)
        diff = exit_price - entry_price if pos_type == 'BUY' else entry_price - exit_price
        pips = diff / config['pip_size']
        pnl = pips * config['pip_value'] * size
        
        self.balance += pnl
        print(f"[Order] CLOSE {pos_type} @ {exit_price}. PnL: ${pnl:+.2f}")
        
        # Remove horizontal price line
        if self.entry_price_line:
            self.entry_price_line.delete()
            self.entry_price_line = None
            
        # Draw close marker
        self.chart.marker(
            time=bar_time,
            position='above' if pos_type == 'BUY' else 'below',
            shape='arrow_down' if pos_type == 'BUY' else 'arrow_up',
            color='#3b82f6',
            text=f"CLOSE (PnL: {pnl:+.1f})"
        )
        
        # Save trade record
        trade_record = {
            'id': f"py-{int(time.time())}-{np.random.randint(1000, 9999)}",
            'symbol': self.symbol,
            'type': pos_type,
            'lotSize': size,
            'entryPrice': entry_price,
            'entryTime': int(pd.to_datetime(entry_time).tz_localize('UTC').timestamp()),
            'exitPrice': exit_price,
            'exitTime': int(pd.to_datetime(bar_time).tz_localize('UTC').timestamp()),
            'pnl': pnl,
            'pnlPips': pips,
            'commission': 0.0,
            'swap': 0.0,
            'status': 'closed',
            'source': 'backtest',
            'tags': []
        }
        self.closed_trades.append(trade_record)
        self.open_position = None
        
        self.update_stats_display()
        self.sync_to_nextjs()

    def on_reset(self, chart):
        self.is_playing = False
        self.chart.topbar['play_pause'].set('▶ Play')
        
        # Delete entry line if exists
        if self.entry_price_line:
            self.entry_price_line.delete()
            self.entry_price_line = None
            
        self.balance = self.initial_balance
        self.open_position = None
        self.closed_trades = []
        self.current_index = min(self.initial_bars_count, len(self.df) - 1)
        
        # Clear chart markers and set data back to initial subset
        initial_df = self.df.iloc[:self.current_index + 1]
        self.chart.set(initial_df)
        self.update_stats_display()
        self.sync_to_nextjs()

    def on_timeframe_change(self, chart):
        new_tf = self.chart.topbar['timeframe'].value
        if new_tf == self.timeframe:
            return
            
        self.is_playing = False
        self.chart.topbar['play_pause'].set('▶ Play')
        
        print(f"[Timeframe] Switching to {new_tf}...")
        
        # Find current candle timestamp to preserve index
        current_time_str = self.df.iloc[self.current_index]['time']
        current_timestamp = pd.to_datetime(current_time_str)
        
        # Re-aggregate raw data
        new_df = self.aggregate_data(self.raw_df, new_tf)
        
        if len(new_df) == 0:
            print("[Timeframe Error] No aggregated bars found.")
            return
            
        # Find closest candle in new aggregated data
        new_df['datetime_temp'] = pd.to_datetime(new_df['time'])
        closest_row = new_df.iloc[(new_df['datetime_temp'] - current_timestamp).abs().argsort()[:1]]
        closest_index = closest_row.index[0]
        new_df = new_df.drop(columns=['datetime_temp'])
        
        # Update state
        self.timeframe = new_tf
        self.df = new_df
        self.current_index = max(self.initial_bars_count, closest_index)
        
        # Reset and reload chart
        initial_df = self.df.iloc[:self.current_index + 1]
        self.chart.set(initial_df)
        
        # If position is open, redraw line at entry price
        if self.open_position and self.entry_price_line:
            self.entry_price_line.delete()
            entry_price = self.open_position['entry_price']
            color = '#10b981' if self.open_position['type'] == 'BUY' else '#ef4444'
            self.entry_price_line = self.chart.horizontal_line(entry_price, color=color)
            
        self.update_stats_display()
        self.sync_to_nextjs()

    # ---------- Next.js Sync ----------
    
    def sync_to_nextjs(self):
        """POST/PUT session update back to Next.js API server."""
        if not self.session_id:
            return
            
        # Map python markers to Next.js markers (convert times to timestamps)
        js_markers = []
        for trade in self.closed_trades:
            # Entry marker
            js_markers.append({
                'time': int(trade['entryTime']),
                'position': 'belowBar' if trade['type'] == 'BUY' else 'aboveBar',
                'color': '#10b981' if trade['type'] == 'BUY' else '#ef4444',
                'shape': 'arrowUp' if trade['type'] == 'BUY' else 'arrowDown',
                'text': f"BUY {trade['lotSize']} Lot"
            })
            # Exit marker
            js_markers.append({
                'time': int(trade['exitTime']),
                'position': 'aboveBar' if trade['type'] == 'BUY' else 'belowBar',
                'color': '#10b981' if trade['pnl'] >= 0 else '#ef4444',
                'shape': 'arrowDown' if trade['type'] == 'BUY' else 'arrowUp',
                'text': f"CLOSE ({trade['pnl']:+.1f})"
            })
            
        if self.open_position:
            js_markers.append({
                'time': int(pd.to_datetime(self.open_position['entry_time']).tz_localize('UTC').timestamp()),
                'position': 'belowBar' if self.open_position['type'] == 'BUY' else 'aboveBar',
                'color': '#10b981' if self.open_position['type'] == 'BUY' else '#ef4444',
                'shape': 'arrowUp' if self.open_position['type'] == 'BUY' else 'arrowDown',
                'text': f"BUY {self.open_position['lot_size']} Lot" if self.open_position['type'] == 'BUY' else f"SELL {self.open_position['lot_size']} Lot"
            })

        # Format open positions
        js_open_positions = []
        if self.open_position:
            js_open_positions.append({
                'id': 'active-position',
                'symbol': self.symbol,
                'type': self.open_position['type'],
                'lotSize': self.open_position['lot_size'],
                'entryPrice': self.open_position['entry_price'],
                'entryTime': int(pd.to_datetime(self.open_position['entry_time']).tz_localize('UTC').timestamp()),
                'currentPrice': float(self.df.iloc[self.current_index]['close']),
                'unrealizedPnl': 0.0,
                'unrealizedPips': 0.0
            })

        # Closed trades map keys to fit Prisma model
        js_closed_trades = []
        for t in self.closed_trades:
            js_closed_trades.append({
                'id': t['id'],
                'symbol': t['symbol'],
                'type': t['type'],
                'lotSize': t['lotSize'],
                'entryPrice': t['entryPrice'],
                'entryTime': t['entryTime'],
                'exitPrice': t['exitPrice'],
                'exitTime': t['exitTime'],
                'pnl': t['pnl'],
                'pnlPips': t['pnlPips'],
                'commission': t['commission'],
                'swap': t['swap'],
                'status': 'closed',
                'source': 'backtest',
                'tags': []
            })
            
        data = {
            'currentBalance': float(self.balance),
            'currentIndex': int(self.current_index),
            'openPositions': js_open_positions,
            'closedTrades': js_closed_trades,
            'markers': js_markers,
            'timeframe': self.timeframe
        }
        
        url = f"http://localhost:3000/api/backtest/sessions/{self.session_id}"
        
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='PUT'
            )
            with urllib.request.urlopen(req, timeout=2.0) as response:
                response.read()
        except Exception as e:
            pass

    def run_headless(self):
        """Aggregate candles and sync to Next.js, then exit."""
        if not self.session_id:
            print("Headless mode requires --session-id to sync data back to Next.js.")
            sys.exit(1)
            
        print("Formatting aggregated candles for Next.js...")
        js_candles = []
        for _, row in self.df.iterrows():
            dt = pd.to_datetime(row['time']).tz_localize('UTC')
            ts = int(dt.timestamp())
            js_candles.append({
                'time': ts,
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': int(row['volume']) if 'volume' in row else 0
            })
            
        print(f"Syncing {len(js_candles)} aggregated candles to Next.js session {self.session_id}...")
        
        data = {
            'allCandles': js_candles,
            'currentBalance': float(self.balance),
            'currentIndex': min(self.initial_bars_count - 1, len(js_candles) - 1),
            'openPositions': [],
            'closedTrades': [],
            'markers': [],
            'timeframe': self.timeframe
        }
        
        url = f"http://localhost:3000/api/backtest/sessions/{self.session_id}"
        
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='PUT'
            )
            with urllib.request.urlopen(req, timeout=10.0) as response:
                response.read()
                print("Session successfully synced to Next.js database.")
        except Exception as e:
            print(f"Error syncing session to Next.js: {e}")
            sys.exit(1)

# ---------- Setup GUI ----------

class LaunchDialog:
    def __init__(self, initial_csv=None, initial_symbol="XAUUSD", initial_tf="15m"):
        self.root = tk.Tk()
        self.root.title("TradingBook Backtest Launcher")
        self.root.geometry("500x530")
        self.root.configure(bg='#0f172a')
        
        # Style configurations
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TLabel', background='#0f172a', foreground='#94a3b8', font=('Arial', 10))
        style.configure('TButton', background='#1e293b', foreground='#f8fafc', font=('Arial', 10, 'bold'))
        style.map('TButton', background=[('active', '#334155')])
        style.configure('TCombobox', fieldbackground='#1e293b', background='#1e293b', foreground='#f8fafc')
        
        self.csv_path = initial_csv or ""
        self.symbol = initial_symbol
        self.timeframe = initial_tf
        self.submitted = False
        
        self.create_widgets()
        
    def create_widgets(self):
        # Header
        header = tk.Label(self.root, text="⚡ Python Backtest Replay Engine", bg='#0f172a', fg='#38bdf8', font=('Arial', 14, 'bold'))
        header.pack(pady=15)
        
        subtitle = tk.Label(self.root, text="Powered by TradingView Lightweight Charts", bg='#0f172a', fg='#94a3b8', font=('Arial', 9, 'italic'))
        subtitle.pack(pady=0)
        
        # Container
        container = tk.Frame(self.root, bg='#0f172a', padx=20, pady=10)
        container.pack(fill='both', expand=True)
        
        # File path selection
        tk.Label(container, text="CSV Bar Data File (OHLCV M1):", bg='#0f172a', fg='#cbd5e1', anchor='w').pack(fill='x', pady=(10, 2))
        file_frame = tk.Frame(container, bg='#0f172a')
        file_frame.pack(fill='x')
        
        self.file_entry = tk.Entry(file_frame, bg='#1e293b', fg='#f8fafc', insertbackground='white', bd=1, relief='solid', font=('Arial', 9))
        self.file_entry.pack(side='left', fill='x', expand=True, ipady=3)
        self.file_entry.insert(0, self.csv_path)
        
        browse_btn = ttk.Button(file_frame, text="Browse...", command=self.browse_file)
        browse_btn.pack(side='right', padx=(5, 0))
        
        # Symbol Selector
        tk.Label(container, text="Select Trading Symbol:", bg='#0f172a', fg='#cbd5e1', anchor='w').pack(fill='x', pady=(15, 2))
        self.symbol_combo = ttk.Combobox(container, values=list(SYMBOLS.keys()), state='readonly')
        self.symbol_combo.set(self.symbol)
        self.symbol_combo.pack(fill='x')
        
        # Timeframe Selector
        tk.Label(container, text="Timeframe Aggregation:", bg='#0f172a', fg='#cbd5e1', anchor='w').pack(fill='x', pady=(15, 2))
        self.tf_combo = ttk.Combobox(container, values=('1m', '5m', '15m', '30m', '1H', '4H', '1D'), state='readonly')
        self.tf_combo.set(self.timeframe)
        self.tf_combo.pack(fill='x')
        
        # Timezone Offset Selector
        tk.Label(container, text="CSV Timezone Offset:", bg='#0f172a', fg='#cbd5e1', anchor='w').pack(fill='x', pady=(15, 2))
        self.tz_labels = [x[0] for x in CSV_TIMEZONES]
        self.tz_combo = ttk.Combobox(container, values=self.tz_labels, state='readonly')
        self.tz_combo.set('UTC')
        self.tz_combo.pack(fill='x')
        
        # Starting Balance
        tk.Label(container, text="Starting Balance ($):", bg='#0f172a', fg='#cbd5e1', anchor='w').pack(fill='x', pady=(15, 2))
        self.balance_entry = tk.Entry(container, bg='#1e293b', fg='#f8fafc', insertbackground='white', bd=1, relief='solid', font=('Arial', 10))
        self.balance_entry.pack(fill='x', ipady=3)
        self.balance_entry.insert(0, "10000.00")
        
        # Launch Button
        launch_btn = tk.Button(container, text="🚀 LAUNCH REPLAY", bg='#0284c7', fg='white', font=('Arial', 11, 'bold'), bd=0, activebackground='#0369a1', activeforeground='white', command=self.on_launch)
        launch_btn.pack(fill='x', pady=(25, 10), ipady=8)
        
    def browse_file(self):
        filename = filedialog.askopenfilename(
            title="Select M1 CSV Data File",
            filetypes=(("CSV Files", "*.csv"), ("All Files", "*.*"))
        )
        if filename:
            self.file_entry.delete(0, tk.END)
            self.file_entry.insert(0, filename)
            # Try to guess symbol
            basename = os.path.basename(filename).upper()
            for sym in SYMBOLS:
                if sym in basename:
                    self.symbol_combo.set(sym)
                    break
                    
    def on_launch(self):
        csv = self.file_entry.get().strip()
        if not csv or not os.path.exists(csv):
            messagebox.showerror("Error", "Please select a valid CSV data file.")
            return
            
        try:
            float(self.balance_entry.get().strip())
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid numeric starting balance.")
            return
            
        self.submitted = True
        self.root.destroy()
        
    def get_values(self):
        self.root.mainloop()
        if self.submitted:
            selected_label = self.tz_combo.get()
            tz_offset = 0
            for label, offset in CSV_TIMEZONES:
                if label == selected_label:
                    tz_offset = offset
                    break
            return {
                'csv': self.file_entry.get().strip(),
                'symbol': self.symbol_combo.get(),
                'tf': self.tf_combo.get(),
                'balance': float(self.balance_entry.get().strip()),
                'tz_offset': tz_offset
            }
        return None

# ---------- Command Line Entry ----------

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="TradingBook Python Chart Replay Engine")
    parser.add_argument('--csv', type=str, help="Absolute path to bar data CSV file")
    parser.add_argument('--symbol', type=str, default="XAUUSD", help="Trading symbol (e.g., XAUUSD)")
    parser.add_argument('--tf', type=str, default="15m", help="Timeframe (e.g., 15m, 1H)")
    parser.add_argument('--balance', type=float, default=10000.0, help="Initial account balance")
    parser.add_argument('--leverage', type=str, default="1:100", help="Account leverage")
    parser.add_argument('--session-id', type=str, help="Next.js Backtest Session ID to sync trades")
    parser.add_argument('--headless', action='store_true', help="Run in headless mode (aggregate and exit)")
    parser.add_argument('--tz-offset', type=int, default=0, help="CSV timezone offset in minutes")
    args, unknown = parser.parse_known_args()
    
    csv_file = args.csv
    symbol = args.symbol
    tf = args.tf
    balance = args.balance
    leverage = args.leverage
    session_id = args.session_id
    headless = args.headless
    tz_offset = args.tz_offset
    
    # If parameters not fully provided, launch Tkinter configuration dialog
    if not csv_file:
        dialog = LaunchDialog(initial_symbol=symbol, initial_tf=tf)
        vals = dialog.get_values()
        if not vals:
            print("Launch cancelled.")
            sys.exit(0)
        csv_file = vals['csv']
        symbol = vals['symbol']
        tf = vals['tf']
        balance = vals['balance']
        tz_offset = vals['tz_offset']
        
    try:
        app = BacktesterApp(
            csv_path=csv_file,
            symbol=symbol,
            timeframe=tf,
            initial_balance=balance,
            session_id=session_id,
            tz_offset=tz_offset
        )
        if headless:
            app.run_headless()
        else:
            app.start()
    except Exception as e:
        if headless:
            print(f"Failed to run backtester headlessly: {e}")
            sys.exit(1)
        # Show crash window
        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("Backtester Error", f"Failed to run backtester:\n{str(e)}")
        raise e
