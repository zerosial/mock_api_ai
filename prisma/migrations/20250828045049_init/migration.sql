-- CreateTable
CREATE TABLE "public"."templates" (
    "id" SERIAL NOT NULL,
    "project" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "requestSpec" JSONB,
    "responseSpec" JSONB,
    "generatedCode" TEXT,
    "mockData" JSONB,
    "delayMs" INTEGER NOT NULL DEFAULT 0,
    "errorCode" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."api_logs" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_logs_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "templates_project_user_apiUrl_method_key" ON "public"."templates"("project", "user", "apiUrl", "method");

-- CreateIndex
CREATE UNIQUE INDEX "proxy_servers_name_key" ON "public"."proxy_servers"("name");

-- CreateIndex
CREATE INDEX "proxy_communication_logs_proxyServerId_path_method_createdA_idx" ON "public"."proxy_communication_logs"("proxyServerId", "path", "method", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."api_logs" ADD CONSTRAINT "api_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_mock_apis" ADD CONSTRAINT "proxy_mock_apis_proxyServerId_fkey" FOREIGN KEY ("proxyServerId") REFERENCES "public"."proxy_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proxy_communication_logs" ADD CONSTRAINT "proxy_communication_logs_proxyServerId_fkey" FOREIGN KEY ("proxyServerId") REFERENCES "public"."proxy_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
