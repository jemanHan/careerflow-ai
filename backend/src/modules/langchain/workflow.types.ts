export type CandidateProfile = {
  summary: string;
  strengths: string[];
  experiences: Array<{
    title: string;
    impact: string;
    techStack: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    evidence: string[];
  }>;
};

export type JobPostingProfile = {
  role: string;
  summary?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  evaluationSignals: string[];
  domainSignals?: string[];
  collaborationSignals?: string[];
  toolSignals?: string[];
  senioritySignals?: string[];
  outputExpectations?: string[];
};

export type GapAnalysis = {
  matchedSignals: string[];
  missingSignals: string[];
  weakEvidence: string[];
};

export type GeneratedDraft = {
  coverLetter: string;
  careerDescription: string;
  projectIntro: string;
};

export type InterviewReportItem = {
  section: "core" | "deep";
  question: string;
  whyAsked: string;
  answerPoints: string[];
  modelAnswer: string;
  caution?: string;
};

export type RewriteDraft = {
  coverLetter: string;
  careerDescription: string;
  projectIntro: string;
};
