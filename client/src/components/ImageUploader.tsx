import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

interface ImageUploaderProps {
  bucket: 'product-images' | 'private-docs';
  urls: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  label?: string;
  helperText?: string;
  onUploadingChange?: (busy:boolean)=>void;
}

/**
 * Rasmni mijoz tomonida (browser canvas) 1280px gacha kichraytiradi
 * va 0.8 sifatli JPEG Blob'ga aylantiradi.
 */
async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1280;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D kontekstini olishda xatolik'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Rasmni siqishda xatolik yuz berdi'));
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Rasmni yuklab bo\'lmadi'));
    };

    img.src = objectUrl;
  });
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  bucket,
  urls,
  onChange,
  maxImages = 5,
  onUploadingChange,
  label = 'Fotosuratlar',
  helperText = 'Kamera orqali suratga oling yoki galereyadan tanlang (1280px gacha avtomatik optimallashtiriladi)',
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const previews=useRef<Record<string,string>>({});
  useEffect(()=>()=>{Object.values(previews.current).forEach(URL.revokeObjectURL);},[]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (urls.length + files.length > maxImages) {
      setError(`Ko'pi bilan ${maxImages} ta rasm yuklash mumkin`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setUploading(true);onUploadingChange?.(true);

    try {
      const newUrls: string[] = [];
      const newPreviews: Record<string, string> = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('JPEG, PNG yoki WebP rasm tanlang (10 MB gacha)');
        // 1. Mijozda rasmni 1280px gacha kichraytirish va siqish
        const compressedBlob = await resizeImage(file);

        // 2. Serverdan imzolangan yuklash URL'ini olish
        const signRes = await api.uploads.sign(bucket, 'image/jpeg', compressedBlob.size);

        // 3. To'g'ridan-to'g'ri Supabase Storage'ga PUT so'rovi bilan yuklash
        const uploadRes = await fetch(signRes.signed_url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/jpeg',
          },
          body: compressedBlob,
        });

        if (!uploadRes.ok) {
          throw new Error(`Rasm yuklashda xatolik yuz berdi (${uploadRes.status})`);
        }

        // private-docs uchun bazaga faqat private-docs:<path> saqlanadi
        const savedIdentifier = bucket === 'private-docs'
          ? `private-docs:${signRes.path}`
          : (signRes.public_url || signRes.path);

        newUrls.push(savedIdentifier);

        // Lokal ko'rinish (preview) uchun blob URL yaratish
        newPreviews[savedIdentifier] = URL.createObjectURL(compressedBlob);
      }

      Object.assign(previews.current,newPreviews);
      setLocalPreviews((prev) => ({ ...prev, ...newPreviews }));
      onChange([...urls, ...newUrls]);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setError(err.message || 'Rasmni yuklashda xatolik yuz berdi');
    } finally {
      setUploading(false);onUploadingChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = (indexToDelete: number) => {
    const target = urls[indexToDelete];
    if (localPreviews[target]) {
      URL.revokeObjectURL(localPreviews[target]);
    }
    const updated = urls.filter((_, idx) => idx !== indexToDelete);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block font-bold text-gray-700">
          {label} ({urls.length}/{maxImages}):
        </label>
        {urls.length > 0 && (
          <span className="text-[11px] text-gray-400">
            {urls.length === 1 ? '1 ta rasm' : `${urls.length} ta rasm`}
          </span>
        )}
      </div>

      {helperText && (
        <p className="text-[11px] text-gray-500">{helperText}</p>
      )}

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Yuklangan rasmlar galereyasi */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {urls.map((url, idx) => {
          const previewSrc = localPreviews[url] || (url.startsWith('http') ? url : null);

          return (
            <div
              key={url + idx}
              className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm flex items-center justify-center"
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={`Yuklangan rasm ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-2 text-center text-gray-500">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1" />
                  <span className="text-[9px] font-bold text-gray-700">Xavfsiz dalil</span>
                </div>
              )}

              {idx === 0 && bucket === 'product-images' && (
                <span className="absolute top-1 left-1 bg-agro-green text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                  Asosiy
                </span>
              )}

              <button
                type="button"
                disabled={uploading}
                onClick={() => handleDelete(idx)}
                className="absolute top-1 right-1 p-1 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full opacity-90 group-hover:opacity-100 transition shadow"
                title="O'chirish"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Yuklash tugmasi (agar limitga yetmagan bo'lsa) */}
        {urls.length < maxImages && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-gray-300 hover:border-agro-green rounded-xl flex flex-col items-center justify-center p-2 text-gray-500 hover:text-agro-green hover:bg-emerald-50/40 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-agro-green mb-1" />
                <span className="text-[10px] font-semibold text-gray-600">Yuklanmoqda...</span>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-1 text-gray-400 mb-1">
                  <Camera className="w-4 h-4" />
                  <Upload className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-center leading-tight">
                  Rasm qo'shish
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Yashirin fayl kiritish (kamera yoki galereya) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple={maxImages > 1}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};
