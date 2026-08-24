import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Provisions one confirmed, known-password customer account for the login
// spec so it doesn't have to fight account-confirmation email delivery in a
// browser test. Idempotent — safe to run against a dev database repeatedly.
const PYTHON_SCRIPT = `
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()
user, _ = User.objects.get_or_create(
    email="e2e.customer@example.com",
    defaults={"username": "e2ecustomer", "first_name": "E2E", "last_name": "Customer"},
)
user.set_password("StrongPass123!")
user.is_active = True
user.account_confirmed_at = timezone.now()
user.save()
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
