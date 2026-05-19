import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Supabase
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  frontendOrigins: (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

// Validate required env vars
export function validateConfig(): void {
  const required = ['GEMINI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

  const missing = required.filter((key) => !process.env[key]);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('ℹ️  Copy .env.example to .env and fill in the values');
  }
}
