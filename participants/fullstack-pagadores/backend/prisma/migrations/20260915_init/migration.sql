-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "card_last4" TEXT NOT NULL,
    "card_brand" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "installment_amount" INTEGER NOT NULL,
    "total_with_interest" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL,
    "net_amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");
