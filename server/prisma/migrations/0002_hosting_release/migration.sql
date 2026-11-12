-- Additive, transactional union of main, audit and phase-1. No application rows are removed.
BEGIN;
CREATE TEMP TABLE _release_unit_backfill ON COMMIT DROP AS
 SELECT NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='Order' AND column_name='unit') AS needed;
DO $$ BEGIN
 IF to_regclass('"Review"') IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM "Review" GROUP BY order_id,reviewer_id,target_user_id HAVING COUNT(*)>1) THEN
   RAISE EXCEPTION 'Duplicate reviews must be reviewed manually before migration. No rows have been deleted.';
  END IF;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "tin_or_passport" TEXT NOT NULL,
    "farm_or_company_name" TEXT,
    "kyc_status" TEXT NOT NULL DEFAULT 'PENDING',
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "wallet_available" INTEGER NOT NULL DEFAULT 0,
    "wallet_escrow" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "telegram_chat_id" TEXT,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "vehicle_type" TEXT,
    "district" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "farmer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price_per_kg" INTEGER NOT NULL,
    "available_quantity_kg" DOUBLE PRECISION NOT NULL,
    "min_order_kg" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "harvest_date" TIMESTAMP(3) NOT NULL,
    "image_url" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pickup_district" TEXT,
    "pickup_address" TEXT,
    "pickup_lat" DOUBLE PRECISION,
    "pickup_lng" DOUBLE PRECISION,
    "pickup_window" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "farmer_id" TEXT NOT NULL,
    "courier_id" TEXT,
    "product_id" TEXT NOT NULL,
    "product_title" TEXT,
    "unit_price_per_kg" INTEGER,
    "quantity_kg" DOUBLE PRECISION NOT NULL,
    "product_total_amount" INTEGER NOT NULL,
    "delivery_fee" INTEGER NOT NULL DEFAULT 15000,
    "total_paid" INTEGER NOT NULL,
    "platform_commission" INTEGER NOT NULL,
    "farmer_payout" INTEGER NOT NULL,
    "courier_payout" INTEGER NOT NULL DEFAULT 12000,
    "platform_logistics_margin" INTEGER NOT NULL DEFAULT 3000,
    "payment_method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "delivery_address" TEXT NOT NULL,
    "delivery_schedule" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "delivery_pin" TEXT,
    "delivery_pin_attempts" INTEGER NOT NULL DEFAULT 0,
    "delivery_district" TEXT,
    "delivery_lat" DOUBLE PRECISION,
    "delivery_lng" DOUBLE PRECISION,
    "paid_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "pickup_district" TEXT,
    "pickup_address" TEXT,
    "pickup_window" TEXT,
    "pickup_lat" DOUBLE PRECISION,
    "pickup_lng" DOUBLE PRECISION,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Dispute" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "refund_amount" INTEGER,
    "admin_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "EmailVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "card_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "admin_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "ProductView" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "first_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "PaymeTransaction" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount_tiyin" BIGINT NOT NULL,
    "provider_time" BIGINT NOT NULL,
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "perform_time" TIMESTAMP(3),
    "cancel_time" TIMESTAMP(3),
    "state" INTEGER NOT NULL DEFAULT 1,
    "reason" INTEGER,

    CONSTRAINT "PaymeTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "order_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password_hash" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "full_name" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tin_or_passport" TEXT NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "farm_or_company_name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kyc_status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_premium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "wallet_available" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "wallet_escrow" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'uz';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_online" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vehicle_type" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "farmer_id" TEXT NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "price_per_kg" INTEGER NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "available_quantity_kg" DOUBLE PRECISION NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "min_order_kg" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "harvest_date" TIMESTAMP(3) NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "image_url" TEXT NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'KG';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pickup_district" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pickup_address" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pickup_lat" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pickup_lng" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pickup_window" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "buyer_id" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "farmer_id" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "courier_id" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "product_id" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "product_title" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unit_price_per_kg" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "quantity_kg" DOUBLE PRECISION NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "product_total_amount" INTEGER NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_fee" INTEGER NOT NULL DEFAULT 15000;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "total_paid" INTEGER NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "platform_commission" INTEGER NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "farmer_payout" INTEGER NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "courier_payout" INTEGER NOT NULL DEFAULT 12000;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "platform_logistics_margin" INTEGER NOT NULL DEFAULT 3000;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "payment_method" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT NOT NULL;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_schedule" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_pin" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_pin_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_district" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_lat" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "delivery_lng" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "picked_up_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickup_district" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickup_address" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickup_window" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickup_lat" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pickup_lng" DOUBLE PRECISION;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "order_id" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "user_id" TEXT NOT NULL;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "amount" INTEGER NOT NULL;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "order_id" TEXT NOT NULL;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "buyer_id" TEXT NOT NULL;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "reason" TEXT NOT NULL;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "evidence_image_url" TEXT;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "refund_amount" INTEGER;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "admin_comment" TEXT;
ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "order_id" TEXT NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "reviewer_id" TEXT NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "target_user_id" TEXT NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "rating" INTEGER NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "comment" TEXT NOT NULL;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "EmailVerification" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "EmailVerification" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;
ALTER TABLE "EmailVerification" ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL;
ALTER TABLE "EmailVerification" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3) NOT NULL;
ALTER TABLE "EmailVerification" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailVerification" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "user_id" TEXT NOT NULL;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "amount" INTEGER NOT NULL;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "card_number" TEXT NOT NULL;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "admin_comment" TEXT;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3);
ALTER TABLE "ProductView" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "ProductView" ADD COLUMN IF NOT EXISTS "product_id" TEXT NOT NULL;
ALTER TABLE "ProductView" ADD COLUMN IF NOT EXISTS "viewer_id" TEXT NOT NULL;
ALTER TABLE "ProductView" ADD COLUMN IF NOT EXISTS "first_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProductView" ADD COLUMN IF NOT EXISTS "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "product_id" TEXT NOT NULL;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "buyer_id" TEXT NOT NULL;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "seller_id" TEXT NOT NULL;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "client_id" TEXT NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "conversation_id" TEXT NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "sender_id" TEXT NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "provider_id" TEXT NOT NULL;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "order_id" TEXT NOT NULL;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "amount_tiyin" BIGINT NOT NULL;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "provider_time" BIGINT NOT NULL;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3) NOT NULL;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "perform_time" TIMESTAMP(3);
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "cancel_time" TIMESTAMP(3);
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "state" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PaymeTransaction" ADD COLUMN IF NOT EXISTS "reason" INTEGER;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "user_id" TEXT NOT NULL;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "order_id" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actor_id" TEXT NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "order_id" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DO $$ BEGIN
 IF (SELECT needed FROM _release_unit_backfill) THEN
  ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'KG';
  UPDATE "Order" o SET "unit"=p."unit" FROM "Product" p WHERE p.id=o.product_id;
 END IF;
END $$;
UPDATE "Order" o SET
 product_title=COALESCE(o.product_title,p.title),
 unit_price_per_kg=COALESCE(o.unit_price_per_kg,CASE WHEN o.quantity_kg>0 THEN ROUND(o.product_total_amount/o.quantity_kg)::integer ELSE p.price_per_kg END),
 pickup_district=COALESCE(o.pickup_district,p.pickup_district),
 pickup_address=COALESCE(o.pickup_address,p.pickup_address),
 pickup_window=COALESCE(o.pickup_window,p.pickup_window),
 pickup_lat=COALESCE(o.pickup_lat,p.pickup_lat),pickup_lng=COALESCE(o.pickup_lng,p.pickup_lng)
FROM "Product" p WHERE p.id=o.product_id;
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "Product_is_active_category_idx" ON "Product"("is_active", "category");
CREATE UNIQUE INDEX IF NOT EXISTS "Dispute_order_id_key" ON "Dispute"("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Review_order_id_reviewer_id_target_user_id_key" ON "Review"("order_id", "reviewer_id", "target_user_id");
CREATE INDEX IF NOT EXISTS "EmailVerification_email_idx" ON "EmailVerification"("email");
CREATE INDEX IF NOT EXISTS "ProductView_product_id_last_viewed_at_idx" ON "ProductView"("product_id", "last_viewed_at");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductView_product_id_viewer_id_key" ON "ProductView"("product_id", "viewer_id");
CREATE INDEX IF NOT EXISTS "Conversation_buyer_id_updated_at_idx" ON "Conversation"("buyer_id", "updated_at");
CREATE INDEX IF NOT EXISTS "Conversation_seller_id_updated_at_idx" ON "Conversation"("seller_id", "updated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_product_id_buyer_id_seller_id_key" ON "Conversation"("product_id", "buyer_id", "seller_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Message_client_id_key" ON "Message"("client_id");
CREATE INDEX IF NOT EXISTS "Message_conversation_id_created_at_id_idx" ON "Message"("conversation_id", "created_at", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymeTransaction_provider_id_key" ON "PaymeTransaction"("provider_id");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymeTransaction_order_id_key" ON "PaymeTransaction"("order_id");
CREATE INDEX IF NOT EXISTS "PaymeTransaction_provider_time_idx" ON "PaymeTransaction"("provider_time");
CREATE INDEX IF NOT EXISTS "Notification_user_id_created_at_idx" ON "Notification"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "AuditLog_actor_id_created_at_idx" ON "AuditLog"("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "AuditLog_order_id_created_at_idx" ON "AuditLog"("order_id", "created_at");
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Product_farmer_id_fkey' AND conrelid='"Product"'::regclass) THEN ALTER TABLE "Product" ADD CONSTRAINT "Product_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Order_buyer_id_fkey' AND conrelid='"Order"'::regclass) THEN ALTER TABLE "Order" ADD CONSTRAINT "Order_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Order_farmer_id_fkey' AND conrelid='"Order"'::regclass) THEN ALTER TABLE "Order" ADD CONSTRAINT "Order_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Order_courier_id_fkey' AND conrelid='"Order"'::regclass) THEN ALTER TABLE "Order" ADD CONSTRAINT "Order_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Order_product_id_fkey' AND conrelid='"Order"'::regclass) THEN ALTER TABLE "Order" ADD CONSTRAINT "Order_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Transaction_order_id_fkey' AND conrelid='"Transaction"'::regclass) THEN ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Transaction_user_id_fkey' AND conrelid='"Transaction"'::regclass) THEN ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Dispute_order_id_fkey' AND conrelid='"Dispute"'::regclass) THEN ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Dispute_buyer_id_fkey' AND conrelid='"Dispute"'::regclass) THEN ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Review_order_id_fkey' AND conrelid='"Review"'::regclass) THEN ALTER TABLE "Review" ADD CONSTRAINT "Review_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Review_reviewer_id_fkey' AND conrelid='"Review"'::regclass) THEN ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Review_target_user_id_fkey' AND conrelid='"Review"'::regclass) THEN ALTER TABLE "Review" ADD CONSTRAINT "Review_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='WithdrawalRequest_user_id_fkey' AND conrelid='"WithdrawalRequest"'::regclass) THEN ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ProductView_product_id_fkey' AND conrelid='"ProductView"'::regclass) THEN ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ProductView_viewer_id_fkey' AND conrelid='"ProductView"'::regclass) THEN ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Conversation_product_id_fkey' AND conrelid='"Conversation"'::regclass) THEN ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Conversation_buyer_id_fkey' AND conrelid='"Conversation"'::regclass) THEN ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Conversation_seller_id_fkey' AND conrelid='"Conversation"'::regclass) THEN ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Message_conversation_id_fkey' AND conrelid='"Message"'::regclass) THEN ALTER TABLE "Message" ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Message_sender_id_fkey' AND conrelid='"Message"'::regclass) THEN ALTER TABLE "Message" ADD CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='PaymeTransaction_order_id_fkey' AND conrelid='"PaymeTransaction"'::regclass) THEN ALTER TABLE "PaymeTransaction" ADD CONSTRAINT "PaymeTransaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Notification_user_id_fkey' AND conrelid='"Notification"'::regclass) THEN ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='Notification_order_id_fkey' AND conrelid='"Notification"'::regclass) THEN ALTER TABLE "Notification" ADD CONSTRAINT "Notification_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='AuditLog_actor_id_fkey' AND conrelid='"AuditLog"'::regclass) THEN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='AuditLog_order_id_fkey' AND conrelid='"AuditLog"'::regclass) THEN ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
COMMIT;
