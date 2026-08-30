import { cn } from "@/lib/utils";

const ORDER_STATUS_STYLES: Record<string, string> = {
  received: "bg-secondary text-secondary-foreground border-transparent",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  preparing: "bg-primary/10 text-primary border-primary/20",
  ready: "bg-sushi-green/10 text-sushi-green border-sushi-green/20",
  out_for_delivery: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-sushi-green/10 text-sushi-green border-sushi-green/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  not_required: "bg-secondary text-secondary-foreground border-transparent",
  pending: "bg-primary/10 text-primary border-primary/20",
  paid: "bg-sushi-green/10 text-sushi-green border-sushi-green/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-secondary text-secondary-foreground border-transparent",
};

const APPROVAL_STATUS_STYLES: Record<string, string> = {
  pending: "bg-primary/10 text-primary border-primary/20",
  approved: "bg-sushi-green/10 text-sushi-green border-sushi-green/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const STYLE_MAPS = {
  order: ORDER_STATUS_STYLES,
  payment: PAYMENT_STATUS_STYLES,
  approval: APPROVAL_STATUS_STYLES,
} as const;

interface StatusBadgeProps {
  status: string;
  kind?: keyof typeof STYLE_MAPS;
  className?: string;
}

function formatStatusLabel(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Consistent color-coded pill for order/payment/review-approval status,
 * reused across the queue, order detail, customer history, and review
 * moderation views instead of each page inventing its own status colors. */
const StatusBadge = ({ status, kind = "order", className }: StatusBadgeProps) => {
  const styles = STYLE_MAPS[kind][status] ?? "bg-secondary text-secondary-foreground border-transparent";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        styles,
        className,
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
};

export default StatusBadge;
