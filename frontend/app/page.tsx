import Link from "next/link";

export default function HomePage() {
  return (
    <main className="space-y-4">
      <h1 className="text-3xl font-bold">CareerFlow AI</h1>
      <p className="text-slate-700">
        이력서/포트폴리오/JD를 분석하고 후속 질문과 지원 문서를 생성하는 MVP입니다.
      </p>
      <Link className="inline-block rounded bg-blue-600 px-4 py-2 text-white" href="/new">
        새 지원서 워크플로우 시작
      </Link>
    </main>
  );
}
