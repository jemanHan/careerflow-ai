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
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4">
      <ResultsClient applicationId={applicationId} />
    </main>
  );
}
