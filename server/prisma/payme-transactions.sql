-- Apply once after the existing schema is in place. No existing data is deleted.
BEGIN;

-- CreateTable
CREATE TABLE "PaymeTransaction" (
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

-- CreateIndex
CREATE UNIQUE INDEX "PaymeTransaction_provider_id_key" ON "PaymeTransaction"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymeTransaction_order_id_key" ON "PaymeTransaction"("order_id");

-- CreateIndex
CREATE INDEX "PaymeTransaction_provider_time_idx" ON "PaymeTransaction"("provider_time");

-- AddForeignKey
ALTER TABLE "PaymeTransaction" ADD CONSTRAINT "PaymeTransaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
