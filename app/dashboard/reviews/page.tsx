"use client";

import {
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  SearchCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type HumanReviewStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "completed";

type HumanReviewPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type HumanReviewLead = {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
};

type HumanReview = {
  id: string;
  work_item_id: string | null;
  lead: HumanReviewLead | null;
  source_agent_name: string | null;
  review_type: string;
  review_reason: string | null;
  review_title: string | null;
  review_summary: string | null;
  review_context: Record<string, unknown> | null;
  recommended_action: string | null;
  priority: HumanReviewPriority;
  status: HumanReviewStatus;
  requested_at: string;
  reviewed_at: string | null;
  review_outcome: string | null;
  review_notes: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const statuses: Array<HumanReviewStatus | "all"> = [
  "all",
  "pending",
  "in_review",
  "approved",
  "rejected",
  "completed",
];

const pageLimit = 25;

const actionConfig = [
  {
    label: "Mark in review",
    status: "in_review",
    icon: SearchCheck,
    outcome: null,
  },
  {
    label: "Approve",
    status: "approved",
    icon: Check,
    outcome: "approved",
  },
  {
    label: "Reject",
    status: "rejected",
    icon: X,
    outcome: "rejected",
  },
  {
    label: "Complete",
    status: "completed",
    icon: CheckCircle2,
    outcome: "completed",
  },
] as const;

function formatStatus(status: HumanReviewStatus | "all") {
  return status
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getLeadLabel(lead: HumanReviewLead | null) {
  if (!lead) {
    return "No linked lead";
  }

  return lead.company || lead.name || lead.email || "Unnamed lead";
}

function formatDate(timestamp: string | null) {
  if (!timestamp) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getStatusTone(status: HumanReviewStatus) {
  if (status === "approved" || status === "completed") {
    return "green";
  }

  if (status === "rejected") {
    return "red";
  }

  if (status === "in_review") {
    return "teal";
  }

  return "yellow";
}

function getPriorityTone(priority: HumanReviewPriority) {
  if (priority === "urgent") {
    return "red";
  }

  if (priority === "high") {
    return "yellow";
  }

  return "zinc";
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<HumanReview[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: pageLimit,
    total: 0,
    totalPages: 1,
  });
  const [statusFilter, setStatusFilter] =
    useState<HumanReviewStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadReviews = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageLimit),
      });

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/human-reviews?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load review inbox");
      }

      const nextReviews = (data.reviews ?? []) as HumanReview[];

      setReviews(nextReviews);
      setPagination(
        data.pagination ?? {
          page,
          limit: pageLimit,
          total: nextReviews.length,
          totalPages: 1,
        }
      );
      setNoteDrafts((previous) => {
        const next = { ...previous };

        for (const review of nextReviews) {
          if (next[review.id] === undefined) {
            next[review.id] = review.review_notes ?? "";
          }
        }

        return next;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load review inbox"
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReviews(1);
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadReviews]);

  const counts = useMemo(() => {
    return reviews.reduce<Record<HumanReviewStatus, number>>(
      (totals, review) => {
        totals[review.status] += 1;
        return totals;
      },
      {
        pending: 0,
        in_review: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
      }
    );
  }, [reviews]);

  async function updateReview({
    review,
    status,
    outcome,
  }: {
    review: HumanReview;
    status: HumanReviewStatus;
    outcome: string | null;
  }) {
    const actionKey = `${review.id}:${status}`;

    setLoadingAction(actionKey);
    setError(null);

    try {
      const payload = {
        status,
        review_outcome: outcome,
        review_notes: noteDrafts[review.id] ?? "",
      };
      console.info("Review Inbox PATCH", {
        review_id: review.id,
        status: payload.status,
        has_review_notes: payload.review_notes.length > 0,
      });

      const response = await fetch(`/api/human-reviews/${review.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        console.error("Review Inbox PATCH failed", {
          review_id: review.id,
          status,
          response_status: response.status,
          error: data.error,
        });

        throw new Error(data.error || "Failed to update review");
      }

      if (!data.success || data.review?.status !== status) {
        console.error("Review Inbox PATCH returned unexpected payload", {
          review_id: review.id,
          expected_status: status,
          payload: data,
        });

        throw new Error("Review update did not confirm the requested status");
      }

      await loadReviews(pagination.page);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update review"
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-white lg:px-10">
      <header className="flex flex-col gap-6 border-b border-zinc-900 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Operator Workspace
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Review Inbox
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500">
            Human review requests that need a person to inspect, approve,
            reject, or close the work item.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(counts).map(([status, count]) => (
            <div
              key={status}
              className="operational-surface rounded-xl border border-zinc-800 bg-zinc-950 p-3"
            >
              <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
                {formatStatus(status as HumanReviewStatus)}
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {count}
              </div>
            </div>
          ))}
        </div>
      </header>

      <section className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                statusFilter === status
                  ? "border-white bg-white text-black"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {formatStatus(status)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void loadReviews()}
          className="operational-surface flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-sm font-semibold text-zinc-200 hover:border-[#00ffcc]/30 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      {error && (
        <div className="mt-6 rounded-xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="mt-8">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-zinc-900 bg-zinc-950 text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading review inbox
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 text-sm text-zinc-500">
            No review requests match this view.
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="operational-surface premium-card rounded-xl border border-zinc-900 bg-zinc-950 p-5"
              >
                <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr_auto] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={getStatusTone(review.status)}>
                        {formatStatus(review.status)}
                      </Badge>
                      <Badge tone={getPriorityTone(review.priority)}>
                        {review.priority}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDate(review.requested_at)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-xl font-semibold">
                      {review.review_title || review.review_type}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">
                      {review.review_summary ||
                        review.review_reason ||
                        "No review reason provided."}
                    </p>
                    {(review.recommended_action ||
                      review.review_title ||
                      review.review_summary) && (
                      <div className="mt-4 rounded-lg border border-zinc-800 bg-black/30 p-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
                          Recommended action
                        </div>
                        <div className="mt-1 text-sm leading-6 text-zinc-200">
                          {review.recommended_action ||
                            review.review_reason ||
                            "Inspect review request and determine next action."}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Detail
                        label="Lead"
                        value={
                          review.lead ? (
                            <Link
                              href={`/dashboard/leads/${review.lead.id}`}
                              className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:text-white"
                            >
                              {getLeadLabel(review.lead)}
                            </Link>
                          ) : (
                            getLeadLabel(review.lead)
                          )
                        }
                      />
                      <Detail
                        label="Source agent"
                        value={
                          review.source_agent_name || "Unknown agent"
                        }
                      />
                      <Detail
                        label="Work item"
                        value={review.work_item_id || "Unlinked"}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <label className="text-xs uppercase tracking-[0.16em] text-zinc-600">
                      Review notes
                    </label>
                    <textarea
                      value={noteDrafts[review.id] ?? ""}
                      onChange={(event) =>
                        setNoteDrafts((previous) => ({
                          ...previous,
                          [review.id]: event.target.value,
                        }))
                      }
                      rows={4}
                      className="mt-2 w-full resize-none rounded-xl border border-zinc-800 bg-black/40 p-3 text-sm leading-6 text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-[#00ffcc]/40"
                      placeholder="Add decision notes"
                    />
                    <div className="mt-2 text-xs text-zinc-600">
                      Outcome: {review.review_outcome || "Not set"} ·
                      Reviewed: {formatDate(review.reviewed_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:w-40 xl:flex-col">
                    {actionConfig.map((action) => {
                      const Icon = action.icon;
                      const actionKey = `${review.id}:${action.status}`;
                      const isLoading = loadingAction === actionKey;

                      return (
                        <button
                          key={action.status}
                          type="button"
                          disabled={loadingAction !== null}
                          onClick={() =>
                            void updateReview({
                              review,
                              status: action.status,
                              outcome: action.outcome,
                            })
                          }
                          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-black px-3 text-sm font-semibold text-zinc-200 transition hover:border-[#00ffcc]/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 xl:w-full"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pagination.totalPages > 1 && (
        <footer className="mt-6 flex items-center justify-between gap-3 text-sm text-zinc-500">
          <div>
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} reviews
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => void loadReviews(pagination.page - 1)}
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 font-semibold text-zinc-300 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void loadReviews(pagination.page + 1)}
              className="h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 font-semibold text-zinc-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </div>
      <div className="mt-1 truncate text-sm leading-5 text-zinc-300">
        {value}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "zinc" | "teal" | "yellow" | "red";
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
        tone === "green"
          ? "border-green-400/20 bg-green-400/10 text-green-300"
          : tone === "teal"
          ? "border-[#00ffcc]/20 bg-[#00ffcc]/10 text-[#00ffcc]"
          : tone === "yellow"
          ? "border-yellow-300/20 bg-yellow-300/10 text-yellow-200"
          : tone === "red"
          ? "border-red-300/20 bg-red-300/10 text-red-200"
          : "border-zinc-700 bg-zinc-900 text-zinc-300"
      }`}
    >
      {children}
    </span>
  );
}
