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

-- CreateIndex
CREATE UNIQUE INDEX "templates_project_user_apiUrl_method_key" ON "public"."templates"("project", "user", "apiUrl", "method");

-- AddForeignKey
ALTER TABLE "public"."api_logs" ADD CONSTRAINT "api_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
