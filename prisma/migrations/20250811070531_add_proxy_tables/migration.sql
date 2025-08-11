-- CreateTable
CREATE TABLE "public"."proxy_servers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proxy_mock_apis" (
    "id" SERIAL NOT NULL,
    "proxyServerId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "requestSpec" JSONB,
    "responseSpec" JSONB,
    "mockData" JSONB,
    "delayMs" INTEGER NOT NULL DEFAULT 0,
    "errorCode" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxy_mock_apis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proxy_servers_name_key" ON "public"."proxy_servers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "proxy_mock_apis_proxyServerId_path_method_key" ON "public"."proxy_mock_apis"("proxyServerId", "path", "method");

-- AddForeignKey
ALTER TABLE "public"."proxy_mock_apis" ADD CONSTRAINT "proxy_mock_apis_proxyServerId_fkey" FOREIGN KEY ("proxyServerId") REFERENCES "public"."proxy_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
