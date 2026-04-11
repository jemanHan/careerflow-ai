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
    <main className="mx-auto min-h-screen w-full max-w-screen-2xl space-y-10 bg-surface px-4 py-8 pt-24 md:px-8">
      <ResultsClient applicationId={applicationId} />
    </main>
  );
}
