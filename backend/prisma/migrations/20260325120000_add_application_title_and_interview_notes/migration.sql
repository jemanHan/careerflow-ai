-- Add workflow display title and interview notes
ALTER TABLE "Application" ADD COLUMN "title" TEXT;
ALTER TABLE "Application" ADD COLUMN "interviewNotesJson" JSONB;

