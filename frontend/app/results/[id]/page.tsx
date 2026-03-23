import ResultsClient from "../../../components/results-client";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ResultPage({ params }: Props) {
  const { id } = await params;
  const applicationId = Number(id);
  if (!applicationId) {
    return (
      <main>
        <p>잘못된 application id 입니다.</p>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">워크플로우 결과 #{applicationId}</h1>
      <p className="text-sm text-slate-600">
        분석 실행/후속답변/문서생성/면접질문생성을 순서대로 눌러 결과를 확인하세요.
      </p>
      <ResultsClient applicationId={applicationId} />
    </main>
  );
}
