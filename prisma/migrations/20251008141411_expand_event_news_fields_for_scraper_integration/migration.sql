-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('USABMX', 'UCI');

-- CreateEnum
CREATE TYPE "NewsSource" AS ENUM ('USABMX', 'UCI');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "city" TEXT,
ADD COLUMN     "continent" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dates_text" TEXT,
ADD COLUMN     "details_url" TEXT,
ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "is_uci_event" BOOLEAN,
ADD COLUMN     "latitude" TEXT,
ADD COLUMN     "longitude" TEXT,
ADD COLUMN     "scraper_id" TEXT,
ADD COLUMN     "source" "EventSource",
ADD COLUMN     "start_date" TIMESTAMP(3),
ADD COLUMN     "state" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "author" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "excerpt" TEXT,
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "scraper_id" TEXT,
ADD COLUMN     "source" "NewsSource",
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "url" TEXT,
ADD COLUMN     "uuid_id" TEXT;
