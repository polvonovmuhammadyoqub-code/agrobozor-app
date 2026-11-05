import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Vercel Serverless muhitida SQLite xatoliklarini oldini olish:
// Vercel lambdalari read-only bo'lgani sababli, agar SQLite ishlatilsa va /tmp da bo'lmasa, uni /tmp ga nusxalaymiz.
const isVercel = !!process.env.VERCEL;
const dbUrl = process.env.DATABASE_URL || '';
let clientOptions = {};
if (isVercel && (!dbUrl || dbUrl.startsWith('file:'))) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
        const candidatePaths = [
            path.join(__dirname, '../prisma/dev.db'),
            path.join(__dirname, '../../server/prisma/dev.db'),
            path.join(__dirname, '../../../server/prisma/dev.db'),
            path.join(__dirname, 'prisma/dev.db'),
            path.join(__dirname, '../../prisma/dev.db'),
            path.join(process.cwd(), 'server/prisma/dev.db'),
            path.join(process.cwd(), 'prisma/dev.db'),
            path.resolve('server/prisma/dev.db'),
            path.resolve('prisma/dev.db'),
            '/var/task/server/prisma/dev.db',
            '/var/task/prisma/dev.db',
        ];
        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                try {
                    fs.copyFileSync(p, tmpDbPath);
                    break;
                }
                catch (e) {
                    console.error('Failed to copy seed db to /tmp:', e);
                }
            }
        }
    }
    process.env.DATABASE_URL = 'file:/tmp/dev.db';
    clientOptions = {
        datasources: {
            db: {
                url: 'file:/tmp/dev.db',
            },
        },
    };
}
const prisma = new PrismaClient(clientOptions);
export default prisma;
