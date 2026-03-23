-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('CREATED', 'ANALYZED', 'FOLLOW_UP_COMPLETED', 'DOCUMENTS_GENERATED');

-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('PARSE_SOURCE', 'EXTRACT_CANDIDATE', 'EXTRACT_JOB', 'DETECT_GAP', 'GENERATE_FOLLOW_UP', 'REGENERATE_CANDIDATE', 'GENERATE_DRAFTS', 'GENERATE_INTERVIEW', 'REWRITE_FOR_JOB');

-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'CREATED',
    "resumeText" TEXT NOT NULL,
    "portfolioText" TEXT NOT NULL,
    "projectDescriptions" TEXT[],
    "targetJobPostingText" TEXT NOT NULL,
    "candidateProfileJson" JSONB,
    "jobPostingJson" JSONB,
    "gapAnalysisJson" JSONB,
    "followUpQuestions" TEXT[],
    "followUpAnswersJson" JSONB,
    "generatedDraftJson" JSONB,
    "rewrittenDraftJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "stage" "WorkflowStage" NOT NULL,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowRun_applicationId_stage_idx" ON "WorkflowRun"("applicationId", "stage");

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
