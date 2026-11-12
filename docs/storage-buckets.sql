-- Supabase SQL editorida faqat tegishli loyihada operator bajaradi.
-- Mavjud bucket cheklovlarini avtomatik almashtirmaydi: natijani dashboardda tekshiring.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
 ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
 ('private-docs', 'private-docs', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
-- Browserga yozish/o'qish policy bermang. Upload faqat server imzolagan URL bilan;
-- private-docs faqat vakolatli server yaratgan qisqa muddatli signed URL bilan o'qiladi.
