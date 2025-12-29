// SUPABASE INFRA
// Main exports for Supabase infrastructure (Client-side only)
//
// Note: Edge Functions are deployed separately via autonomousvault-supabase-template

// Client
export * from './client';
export * from './env';

// Auth
export * from './auth/auth.service';

// Setup Wizard
export * from './setup-wizard.service';

// Monetization (types only)
export * from './monetization/limits.stub';
