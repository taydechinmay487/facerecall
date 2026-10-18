import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { EmptyState } from "../components/ui/empty-state";

export function NotFoundPage() {
  return (
    <div className="app-grid flex min-h-screen items-center py-16">
      <div className="mx-auto w-full max-w-xl">
        <EmptyState
          icon={Compass}
          title="That page does not exist"
          description="The link may be out of date. You can go back to the landing page or open the dashboard."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/app"
                className="inline-flex min-h-[44px] items-center rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-strong"
              >
                Open FaceRecall
              </Link>
              <Link
                to="/"
                className="inline-flex min-h-[44px] items-center rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-muted"
              >
                Back to the home page
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
