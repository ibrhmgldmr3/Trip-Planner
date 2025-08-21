-- CreateEnum
CREATE TYPE "public"."TripStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "preferredTransport" TEXT DEFAULT 'all',
    "preferredCurrency" TEXT DEFAULT 'TRY',
    "interests" TEXT,
    "preferences" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."Trip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT,
    "notes" TEXT,
    "status" "public"."TripStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Activity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "cost" DOUBLE PRECISION,
    "category" TEXT,
    "tripId" TEXT NOT NULL,
    "placeId" TEXT,
    "coordinates" JSONB,
    "duration" INTEGER,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiConversation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "tags" TEXT,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Accommodation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceUnit" TEXT NOT NULL DEFAULT 'total',
    "bookingUrl" TEXT,
    "type" TEXT,
    "amenities" TEXT,
    "address" TEXT,
    "coordinates" JSONB,
    "rating" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmation" TEXT,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transportation" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "departureLocation" TEXT NOT NULL,
    "arrivalLocation" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "bookingReference" TEXT,
    "bookingUrl" TEXT,
    "seats" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "Transportation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyPlan" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "activities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BudgetItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "date" TIMESTAMP(3),
    "isEstimate" BOOLEAN NOT NULL DEFAULT true,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Activity" ADD CONSTRAINT "Activity_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiConversation" ADD CONSTRAINT "AiConversation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Accommodation" ADD CONSTRAINT "Accommodation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transportation" ADD CONSTRAINT "Transportation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyPlan" ADD CONSTRAINT "DailyPlan_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BudgetItem" ADD CONSTRAINT "BudgetItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "public"."Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
