import { Router } from 'express';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken } from '../middleware/auth.js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config.js';
const router = Router();
const ALLOWED_MIME_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
const ALLOWED_BUCKETS = ['product-images', 'private-docs'];
// Supabase client — faqat serverda service role kaliti bilan yaratiladi
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    })
    : null;
/**
 * POST /api/uploads/sign
 * Xavfsiz rasm yuklash uchun imzolangan (signed) PUT URL generatsiya qiladi.
 * Fayllar server xotirasidan o'tmasdan to'g'ridan-to'g'ri Supabase Storage'ga yuklanadi.
 */
router.post('/sign', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { bucket, content_type } = req.body || {};
        // 1. Bucket tekshiruvi
        if (!ALLOWED_BUCKETS.includes(bucket)) {
            return res.status(400).json({
                error: "Noto'g'ri bucket nomi. Ruxsat etilgan: 'product-images', 'private-docs'",
            });
        }
        // 2. Rol bo'yicha kirish huquqi tekshiruvi
        if (bucket === 'product-images' && user.role !== 'FARMER') {
            return res.status(403).json({
                error: 'Mahsulot rasmini faqat fermer yuklay oladi',
            });
        }
        if (bucket === 'private-docs' && !['BUYER_B2C', 'BUYER_B2B'].includes(user.role)) {
            return res.status(403).json({
                error: 'Nizo dalilini faqat xaridor yuklay oladi',
            });
        }
        // 3. MIME type tekshiruvi
        const ext = ALLOWED_MIME_TYPES[String(content_type).toLowerCase()];
        if (!ext) {
            return res.status(400).json({
                error: 'Ruxsat etilgan rasm turlari: image/jpeg, image/png, image/webp',
            });
        }
        // 4. Supabase konfiguratsiyasi mavjudligini tekshirish
        if (!supabase) {
            return res.status(503).json({
                error: "Supabase Storage sozlanmagan. Iltimos, SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY ni tekshiring.",
            });
        }
        // 5. Serverda xavfsiz unikal fayl nomini generatsiya qilish
        const fileName = `${user.id}/${randomUUID()}.${ext}`;
        // 6. Imzolangan upload URL olish (createSignedUploadUrl)
        const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(fileName);
        if (error || !data) {
            console.error('Supabase signed URL error:', error?.message);
            return res.status(500).json({
                error: "Yuklash havolasini yaratishda xatolik yuz berdi",
            });
        }
        // 7. Yakuniy URL
        let publicUrl = data.signedUrl;
        if (bucket === 'product-images') {
            const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(fileName);
            publicUrl = pubData.publicUrl;
        }
        return res.json({
            signed_url: data.signedUrl,
            public_url: publicUrl,
            path: fileName,
            token: data.token,
        });
    }
    catch (err) {
        console.error('Upload sign error:', err?.message || err);
        return res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
});
export default router;
