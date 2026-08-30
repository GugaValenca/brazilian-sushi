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
//
// Also provisions a second customer with two saved addresses (one default,
// one not) and an order delivered to the non-default one, so the admin spec
// can assert the "not this customer's default address" warning banner
// without driving a full signed-in checkout through the browser.
const PYTHON_SCRIPT = `
from django.contrib.auth import get_user_model
from django.utils import timezone

from accounts.models import Address
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

delivery_customer, _ = User.objects.get_or_create(
    email="e2e.delivery.customer@example.com",
    defaults={"username": "e2edeliverycustomer", "first_name": "E2E", "last_name": "DeliveryCustomer"},
)
delivery_customer.set_password("StrongPass123!")
delivery_customer.is_active = True
delivery_customer.account_confirmed_at = timezone.now()
delivery_customer.save()

home_address, _ = Address.objects.update_or_create(
    user=delivery_customer,
    label="Home",
    defaults={
        "recipient_name": "E2E DeliveryCustomer",
        "phone_number": "5555550101",
        "line_1": "1 Home Street",
        "city": "Tampa",
        "state": "FL",
        "postal_code": "33601",
        "is_default": True,
    },
)
work_address, _ = Address.objects.update_or_create(
    user=delivery_customer,
    label="Work",
    defaults={
        "recipient_name": "E2E DeliveryCustomer",
        "phone_number": "5555550102",
        "line_1": "2 Work Avenue",
        "city": "Tampa",
        "state": "FL",
        "postal_code": "33602",
        "is_default": False,
    },
)

Order.objects.update_or_create(
    guest_email="e2e.nondefault.order@example.com",
    defaults={
        "customer": delivery_customer,
        "delivery_address": work_address,
        "order_type": Order.OrderType.DELIVERY,
        "status": Order.Status.RECEIVED,
        "payment_status": Order.PaymentStatus.NOT_REQUIRED,
        "guest_name": "E2E NonDefault Order",
        "guest_phone": "5555550102",
        "subtotal": "20.00",
        "total": "25.00",
    },
)

address_customer, _ = User.objects.get_or_create(
    email="e2e.address.customer@example.com",
    defaults={"username": "e2eaddresscustomer", "first_name": "E2E", "last_name": "AddressCustomer"},
)
address_customer.set_password("StrongPass123!")
address_customer.is_active = True
address_customer.account_confirmed_at = timezone.now()
address_customer.save()

# Dedicated to account.spec.ts's Make Default test -- kept separate from
# delivery_customer's Home/Work above so that test's mutation (flipping
# which address is_default) can never leave the admin spec's fixture in an
# inconsistent state depending on file run order.
Address.objects.update_or_create(
    user=address_customer,
    label="Primary",
    defaults={
        "recipient_name": "E2E AddressCustomer",
        "phone_number": "5555550103",
        "line_1": "3 Primary Lane",
        "city": "Tampa",
        "state": "FL",
        "postal_code": "33603",
        "is_default": True,
    },
)
Address.objects.update_or_create(
    user=address_customer,
    label="Secondary",
    defaults={
        "recipient_name": "E2E AddressCustomer",
        "phone_number": "5555550104",
        "line_1": "4 Secondary Lane",
        "city": "Tampa",
        "state": "FL",
        "postal_code": "33604",
        "is_default": False,
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
