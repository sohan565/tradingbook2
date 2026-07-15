# 📈 TradingBook 2

A comprehensive, modern Web-based Trading Journal and interactive Backtesting Suite designed for retail and professional traders. TradingBook 2 integrates a Next.js web application, a MetaTrader 5 (MT5) Expert Advisor (EA) for automatic sync, and a local Python-based backtester with lightweight interactive charting.

---

## 🚀 Key Features

*   **📊 Web-based Trading Journal**: Track your trades across multiple accounts (demo/live) with real-time statistics, performance metrics, and historical logs.
*   **✍️ Daily Journaling with Mood Tracking**: Log daily notes, market bias, mood tags (`focused`, `confident`, `neutral`, `anxious`, `frustrated`, `euphoric`), pre-session plans, post-session reviews, and upload screenshots of chart markups.
*   **🔗 Automated MT5 Sync**: Seamlessly push execution history from MetaTrader 5 to your Web Journal using a robust MQL5 Expert Advisor (`TradingBookSync.mq5`).
*   **📉 Desktop Backtester Engine**: A standalone Python backtester (`backtester.py`) using `lightweight-charts` and a `tkinter` interface to backtest strategies offline using custom CSV candle data. Pushes results back to the web application.
*   **🕯️ Interactive Charts**: Built-in support for TradingView's Lightweight Charts including customized technical indicators, custom drawings, and dynamic markers.

---

## 🛠️ Tech Stack & Technologies

### 1. Web Application (`src/`)
*   **Framework**: Next.js 15 (App Router, Turbopack)
*   **Language**: TypeScript, React 19
*   **Database**: PostgreSQL
*   **ORM**: Prisma Client
*   **Charting**: TradingView `lightweight-charts` (with drawing and indicator plugins)
*   **Styling**: Vanilla CSS Modules & CSS variables (configured with Next Themes for Light/Dark mode compatibility)

### 2. MetaTrader 5 Sync (`TradingBookSync.mq5`)
*   **Language**: MQL5 (C++)
*   **Method**: WebRequest HTTP POST payload directly to Next.js API webhooks (`/api/webhooks/mt5`) with secure API Key authentication.

### 3. Local Backtester (`backtester.py`)
*   **Language**: Python 3
*   **UI/GUI**: `tkinter`
*   **Interactive Chart**: `py-lightweight-charts` wrapper
*   **Data Science**: `pandas`, `numpy` for data parsing and timezone offsets

---

## 🗄️ Database Schema (`prisma/schema.prisma`)

*   `TradeRecord`: Represents individual trades. Tracks entry/exit price and time, P&L, pips, commissions, swap, stop loss, take profit, tags, and screenshots. Sources can be `backtest`, `mt5`, or `manual`.
*   `JournalEntry`: Daily notes. Tracks pre-session plan, post-session review, overall mood, tags, and links multiple trades to a specific day.
*   `MTAccount`: Tracks MT5 sync accounts. Stores account numbers, broker names, sync status, and secure API keys.
*   `BacktestSession`: Tracks backtesting sessions. Stores aggregated historical candles (JSON format), open/closed positions, chart markers, drawings, and indicator states.

---

## ⚙️ Getting Started

### 1. Web Application Setup

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/sohan565/tradingbook2.git
    cd tradingbook2
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    # or
    pnpm install
    # or
    yarn install
    ```
3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add your database URL:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/tradingbook"
    ```
4.  **Database Migration**:
    ```bash
    npx prisma db push
    ```
5.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:3000` to view the application.

### 2. MetaTrader 5 Sync Setup

1.  Open **MetaEditor** inside MetaTrader 5 (F4).
2.  Create a new Expert Advisor (EA), paste the code from [TradingBookSync.mq5](file:///c:/Users/gauta/OneDrive/Desktop/tradingbook2/TradingBookSync.mq5), and compile.
3.  In the MT5 Terminal, go to **Tools -> Options -> Expert Advisors**.
4.  Check **"Allow WebRequest for listed URL"** and add:
    `http://localhost:3000` (or your hosted server URL).
5.  Drag the compiled EA onto any active chart and enter your **API Key** generated in the TradingBook web interface.

### 3. Local Python Backtester Setup

1.  Ensure you have Python 3 installed.
2.  Install the required packages:
    ```bash
    pip install pandas numpy lightweight-charts
    ```
3.  Run the backtester GUI:
    ```bash
    python backtester.py
    ```

---

## 🔒 License & Usage
This project is private and intended for personal/proprietary trading journaling and backtesting. Please see the license terms (if applicable) for distribution rights.
