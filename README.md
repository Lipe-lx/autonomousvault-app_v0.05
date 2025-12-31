# AutonomousVault v0.05

> **Non-Custodial Autonomous Trading & Wealth Management**

AutonomousVault is a cutting-edge, privacy-first platform that merges autonomous
AI agents with decentralized finance (DeFi). It enables users to execute
sophisticated trading strategies across multiple protocols while maintaining
complete self-custody of their assets.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.05-green.svg)

---

## 🚀 Key Features

### 🤖 Autonomous AI Agent

- **Intelligent Execution**: Native AI agents capable of analyzing market
  conditions and executing trades automatically.
- **Natural Language Interface**: Interact with your vault using natural
  language commands (e.g., "Analyze SOL volatility," "Find high-yield pools on
  Meteora").
- **Adaptive Learning**: The system learns from market patterns to optimize
  execution strategies.

### 🌐 Multi-Protocol Support

Seamlessly interact with top-tier DeFi protocols across the Solana ecosystem and
beyond:

- **Solana**: Diverse token swaps and liquidity management.
- **Raydium**: Access deep liquidity for swaps and LP positions.
- **Meteora**: Optimized dynamic liquidity provisioning.
- **Hyperliquid**: High-performance decentralized perpetual exchange interface.
- **Polymarket**: Direct integration with information markets for hedging and
  speculation.

### 📊 Advanced Financial Analytics

- **Real-time Volatility Tracking**: Monitor asset volatility to inform trading
  decisions.
- **PnL Monitoring**: Comprehensive dashboard for tracking profit and loss
  across all positions.
- **Liquidity Pool Insights**: Deep dive into pool metrics to find the best
  yields.

### 🛡️ Non-Custodial Security First

- **Client-Side Encryption**: Your private keys are encrypted locally in your
  browser.
- **Zero Knowledge**: The server never sees your keys or seed phrases.
- **Local Execution**: Sensitive operations are signed locally, ensuring you
  remain in control.

---

## 🏗️ Architecture

The application follows a secure, decoupled architecture throughout:

```mermaid
graph TD
    User[User / Browser] -->|Encrypted Keys| LocalStorage[Local Storage]
    User -->|HTTPS| Client[React Client (Vite)]
    Client -->|RPC Calls| Solana[Solana Blockchain]
    Client -->|API| Hyperliquid[Hyperliquid API]
    Client -->|API| Supabase[Supabase (Auth & Data)]
    Client -->|LLM Calls| AI[Google Gemini / AI Provider]
    
    subgraph "Security Boundary"
        Local[Local Environment]
        LocalStorage
    end
```

- **Frontend**: React 19 + Vite (High maintainability and performance).
- **Backend**: Supabase (Authentication, Database, Edge Functions).
- **AI Engine**: Google Gemini (Reasoning and extensive context window).

---

## 🛠️ Technology Stack

- **Frontend**: React 19, Vite, TypeScript, TailwindCSS
- **UI Components**: Radix UI, Lucide React, Framer Motion
- **State Management**: Zustand
- **Visualization**: Recharts
- **Blockchain**: @solana/web3.js, @raydium-io/raydium-sdk, ethers (for
  Hyperliquid signing)
- **Backend Services**: Supabase (PostgreSQL, Auth, Edge Functions)

---

## 🚦 Getting Started

### Prerequisites

- Node.js (v18+)
- NPM or Bun
- A Supabase project (for backend sync)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd autonomousvault-app
   ```

2. **Install Client Dependencies**
   ```bash
   cd client
   npm install
   ```

3. **Environment Setup** Create a `.env` file in `client/` (optional for local
   dev, usually configured via UI):
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Connect Backend**
   - Open the app in your browser (usually `http://localhost:5173`).
   - Navigate to **Settings** -> **Connect Backend**.
   - Enter your Supabase credentials to sync data and enable cloud features.

---

## 🧪 Development Commands

```bash
cd client
npm run dev      # Start local development server
npm run build    # Build for production
npm run preview  # Preview production build
```

---

## ⚠️ Disclaimer

**AutonomousVault** is experimental software. Trading cryptocurrencies and using
DeFi protocols involves significant risk. The authors are not responsible for
any financial losses incurred while using this software. Always audit your
strategies and keep your private keys safe.

---

_Built with ❤️ for the Decentralized Future._
