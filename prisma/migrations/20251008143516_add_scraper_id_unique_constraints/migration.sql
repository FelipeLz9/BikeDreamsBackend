/*
  Warnings:

  - A unique constraint covering the columns `[scraper_id]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[scraper_id]` on the table `News` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Event_scraper_id_key" ON "Event"("scraper_id");

-- CreateIndex
CREATE UNIQUE INDEX "News_scraper_id_key" ON "News"("scraper_id");
