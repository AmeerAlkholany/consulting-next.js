import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { AdminAuditLogRow } from "@/server/dal/admin";

interface AuditLogTableProps {
  logs: AdminAuditLogRow[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-muted-foreground">
            <th className="p-3 text-left font-medium">Timestamp</th>
            <th className="p-3 text-left font-medium">Action</th>
            <th className="p-3 text-left font-medium">Actor</th>
            <th className="p-3 text-left font-medium">Entity</th>
            <th className="p-3 text-left font-medium">Metadata</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-6 text-center text-muted-foreground">
                No audit events recorded within the selected timeframe.
              </td>
            </tr>
          ) : (
            logs.map((log) => {
              const metaString =
                log.metadata && typeof log.metadata === "object"
                  ? JSON.stringify(log.metadata, null, 2)
                  : String(log.metadata || "—");

              return (
                <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    <Badge variant="outline" className="font-mono">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-foreground">
                      {log.actorFullName || "System / Automated"}
                    </div>
                    {log.actorEmail && (
                      <div className="text-xs text-muted-foreground">{log.actorEmail}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <span className="font-medium text-muted-foreground block">
                      {log.entityType}
                    </span>
                    <span className="font-mono text-muted-foreground/80 truncate block max-w-[120px]">
                      {log.entityId}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    <pre className="font-mono text-xs bg-muted/60 p-1.5 rounded max-h-20 overflow-auto max-w-sm whitespace-pre-wrap">
                      {metaString}
                    </pre>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
