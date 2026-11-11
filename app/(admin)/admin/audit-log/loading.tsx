import { TableSkeleton, PageHeaderSkeleton } from "@/components/feedback/loading-skeletons";
import { Container } from "@/components/layout/container";

export default function AdminAuditLogLoading() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </Container>
  );
}
