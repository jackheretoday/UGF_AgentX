/**
 * Checks TYI Mock USD balance + UGF login for the global signer.
 * Run: npm run diagnose:ugf
 */
import dotenv from 'dotenv';
import { diagnoseSignerSettlement } from '../src/services/ugfSettlement.js';
import { isUgfSignerConfigured } from '../src/config/env.js';

dotenv.config();

if (!isUgfSignerConfigured()) {
  console.error('UGF_SIGNER_PRIVATE_KEY is missing or invalid in Backend/.env');
  process.exit(1);
}

diagnoseSignerSettlement().catch((error) => {
  console.error('Diagnostics failed:', error);
  process.exit(1);
});
