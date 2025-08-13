-- CreateTable
CREATE TABLE "public"."proxy_communication_logs" (
    "id" SERIAL NOT NULL,
    "proxyServerId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proxy_communication_logs_proxyServerId_path_method_createdA_idx" ON "public"."proxy_communication_logs"("proxyServerId", "path", "method", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."proxy_communication_logs" ADD CONSTRAINT "proxy_communication_logs_proxyServerId_fkey" FOREIGN KEY ("proxyServerId") REFERENCES "public"."proxy_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
