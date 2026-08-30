import { Link } from "react-router-dom";

import { usePageMeta } from "@/hooks/usePageMeta";

const AdminNotFoundPage = () => {
  usePageMeta({ title: "Page Not Found | Admin", description: "Admin page not found.", robots: "noindex,nofollow" });

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This admin page doesn't exist.</p>
      <Link to="/admin" className="mt-6 rounded-lg bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        Back to overview
      </Link>
    </div>
  );
};

export default AdminNotFoundPage;
