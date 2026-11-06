import { CircleCheck, CircleX, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TxStatus } from "@/types";

const CONFIG: Record<
  TxStatus,
  { label: string; tone: "lime" | "coral" | "white"; Icon: typeof Clock }
> = {
  confirmed: { label: "Confirmed", tone: "lime", Icon: CircleCheck },
  pending: { label: "Pending", tone: "white", Icon: Clock },
  failed: { label: "Failed", tone: "coral", Icon: CircleX },
};

export function StatusBadge({
  status,
  size = "sm",
}: {
  status: TxStatus;
  size?: "xs" | "sm" | "md";
}) {
  const { label, tone, Icon } = CONFIG[status];
  return (
    <Badge tone={tone} size={size}>
      <Icon
        className={
          status === "pending" ? "size-3 animate-blink" : "size-3"
        }
        aria-hidden="true"
      />
      {label}
    </Badge>
  );
}
