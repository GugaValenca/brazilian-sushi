import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}

/** Label + control + optional hint, spaced consistently across every admin
 * form (delivery zones, coupons, promotions, menu items). */
const FormField = ({ label, htmlFor, children, hint }: FormFieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

export default FormField;
