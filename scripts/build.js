import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('[BUILD] Building client with Vite...');
execSync('npm --prefix client run build', { stdio: 'inherit' });

console.log('[BUILD] Copying client/dist to root dist...');
const src = path.resolve('client/dist');
const dest = path.resolve('dist');

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}
fs.cpSync(src, dest, { recursive: true });
console.log('[BUILD] Complete! Ready for Vercel deployment.');
