import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
    {Icon ? <Icon className="mb-3 h-9 w-9 text-muted-foreground" aria-hidden="true" /> : null}
    <p className="font-medium text-foreground">{title}</p>
    {description ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export default EmptyState;
