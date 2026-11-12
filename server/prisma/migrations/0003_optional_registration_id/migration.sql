-- Preserve every existing value, including historical placeholders.
-- Only new registrations without a document will store NULL.
ALTER TABLE "User" ALTER COLUMN "tin_or_passport" DROP NOT NULL;
