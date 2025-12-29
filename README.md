# AutonomousVault App

Non-custodial autonomous trading application.

## Architecture

```
autonomousvault-app/
├── core/       → Domain logic (symlink)
├── adapters/   → External interfaces (symlink)
├── client/     → React frontend (symlink)
└── infra/
    └── supabase/   # Client-side Supabase integration
```

## Setup

1. **Deploy Backend** (separate repo)
   ```bash
   # Deploy autonomousvault-supabase-template to your Supabase account
   ```

2. **Install Dependencies**
   ```bash
   cd client
   npm install
   ```

3. **Connect Backend**
   - Launch app: `npm run dev`
   - Go to Settings → Connect Backend
   - Enter your Supabase URL + anon key

## Development

```bash
cd client
npm run dev     # Start dev server
npm run build   # Production build
```

## Non-Custodial Guarantees

- Private keys encrypted client-side
- Decryption only in user's browser
- No server access to keys

---

*AutonomousVault v0.04*
