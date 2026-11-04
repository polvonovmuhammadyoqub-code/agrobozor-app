import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');

const dbUrl = process.env.DATABASE_URL || '';
if (fs.existsSync(schemaPath)) {
  let content = fs.readFileSync(schemaPath, 'utf-8');
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    console.log('🔄 PostgreSQL DATABASE_URL aniqlandi. schema.prisma -> postgresql ga moslashtirilmoqda...');
    content = content.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  } else {
    content = content.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  }
  fs.writeFileSync(schemaPath, content, 'utf-8');
}
