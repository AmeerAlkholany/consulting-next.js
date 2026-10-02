import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Container } from "@/components/layout/container";

export default function AdminConsultantsLoading() {
  return (
    <Container className="flex flex-col gap-6 py-8">
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-24" /></th>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-32" /></th>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-20" /></th>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-32" /></th>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
                  <th className="px-4 py-3"><Skeleton className="h-4 w-24" /></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}