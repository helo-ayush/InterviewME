import InterviewRoom from '@/components/interview/InterviewRoom';

export default async function InterviewPage({ params }) {
  const { sessionId } = await params;
  return <InterviewRoom sessionId={sessionId} />;
}
