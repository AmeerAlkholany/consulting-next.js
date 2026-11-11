import { CardListSkeleton, PageHeaderSkeleton } from "@/components/feedback/loading-skeletons";
import { Container } from "@/components/layout/container";

export default function AppointmentsLoading() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeaderSkeleton />
      <CardListSkeleton count={4} />
    </Container>
  );
}
