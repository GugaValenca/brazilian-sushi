import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Provisions one confirmed, known-password customer account for the login
// spec, plus a staff account and a fresh "received" order for the admin
// spec, so neither has to fight account-confirmation email delivery or
// build an order through the full checkout flow in a browser test.
// Idempotent — safe to run against a dev database repeatedly. The order is
// reset to "received" on every run rather than left as-is, since the admin
// spec advances its status and a stale, already-confirmed order from a
// previous run would make "Confirm order" never appear.
const PYTHON_SCRIPT = `
from django.contrib.auth import get_user_model
from django.utils import timezone

from orders.models import Order

User = get_user_model()
customer, _ = User.objects.get_or_create(
    email="e2e.customer@example.com",
    defaults={"username": "e2ecustomer", "first_name": "E2E", "last_name": "Customer"},
)
customer.set_password("StrongPass123!")
customer.is_active = True
customer.account_confirmed_at = timezone.now()
customer.save()

staff, _ = User.objects.get_or_create(
    email="e2e.staff@example.com",
    defaults={"username": "e2estaff", "first_name": "E2E", "last_name": "Staff"},
)
staff.set_password("StrongPass123!")
staff.is_active = True
staff.is_staff = True
staff.account_confirmed_at = timezone.now()
staff.save()

Order.objects.update_or_create(
    guest_email="e2e.order@example.com",
    defaults={
        "order_type": Order.OrderType.PICKUP,
        "status": Order.Status.RECEIVED,
        "payment_status": Order.PaymentStatus.NOT_REQUIRED,
        "guest_name": "E2E Order",
        "guest_phone": "5555550100",
        "subtotal": "15.00",
        "total": "15.00",
    },
)

print("E2E_USER_READY")
`;

export default function globalSetup(): void {
  const repoRoot = path.resolve(__dirname, "..");
  const output = execFileSync("python", ["manage.py", "shell"], {
    cwd: repoRoot,
    input: PYTHON_SCRIPT,
    encoding: "utf-8",
  });

  if (!output.includes("E2E_USER_READY")) {
    throw new Error(`Failed to provision the e2e test user. Output:\n${output}`);
  }
}
