/**
 * M12: Reviewer Dashboard
 * Owner: Frontend Dev 3
 * Dependencies: adsAPI, analyticsAPI
 *
 * Review marketing strategies, edit plans, adjust budgets,
 * add protocol docs, and send suggestions back to AI.
 * Styles: use classes from index.css only — no raw Tailwind color utilities.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PageWithSidebar, SectionCard, MetricSummaryCard, CampaignStatusBadge,
} from "../shared/Layout";
import { adsAPI } from "../../services/api";
import {
  Eye, CheckCircle, BarChart3, ClipboardList,
} from "lucide-react";

/* ══════════════════════════════════════════════
   SHARED SUB-COMPONENTS
══════════════════════════════════════════════ */

function Tag({ children }) {
  return (
    <span style={{
      display: "inline-block",
      background: "var(--color-primary-light, #dcfce7)",
      color: "var(--color-primary, #166534)",
      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 500,
      marginRight: 4, marginBottom: 4,
    }}>
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════
   PAGE: DASHBOARD (queue list)
══════════════════════════════════════════════ */

function DashboardPage({ ads, reviewable, reviewed, onReview }) {
  return (
    <PageWithSidebar>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Reviewer Dashboard</h1>
          <p className="page-header__subtitle">Review and approve marketing strategies</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricSummaryCard label="Pending Review"  value={reviewable.length} icon={Eye} />
        <MetricSummaryCard label="Approved"        value={reviewed.length}   icon={CheckCircle} />
        <MetricSummaryCard label="Total Campaigns" value={ads.length}        icon={BarChart3} />
      </div>

      {/* Queue table */}
      <SectionCard
        title="Review Queue"
        subtitle={`${reviewable.length} campaign${reviewable.length !== 1 ? "s" : ""} awaiting review`}
      >
        {reviewable.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={40} className="empty-state__icon" />
            <p className="empty-state__text">No campaigns pending review</p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px 90px 80px 110px",
              padding: "8px 16px",
              borderBottom: "1px solid var(--color-border, #e5e7eb)",
            }}>
              {["Campaign", "Platforms", "Budget", "Type", ""].map((h) => (
                <span key={h} style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--color-sidebar-text)",
                }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {reviewable.map((ad) => (
              <div
                key={ad.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 180px 90px 80px 110px",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--color-border, #e5e7eb)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-card-bg, #f9fafb)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {/* Title + date */}
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--color-input-text)" }}>{ad.title}</p>
                  <p style={{ fontSize: 12, color: "var(--color-sidebar-text)", marginTop: 2 }}>
                    {new Date(ad.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                {/* Platforms */}
                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {ad.platforms?.map((p) => <Tag key={p}>{p}</Tag>)}
                </div>
                {/* Budget */}
                <p style={{ fontSize: 13, color: "var(--color-input-text)", fontWeight: 500 }}>
                  ${ad.budget?.toLocaleString() || "N/A"}
                </p>
                {/* Type */}
                <p style={{ fontSize: 12, color: "var(--color-sidebar-text)", textTransform: "capitalize" }}>
                  {ad.ad_type?.join(", ")}
                </p>
                {/* CTA */}
                <button
                  onClick={() => onReview(ad)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    background: "var(--color-primary, #166534)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Eye size={14} /> Review
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Reviewed campaigns */}
      {reviewed.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionCard title="Reviewed" subtitle={`${reviewed.length} completed`}>
            {reviewed.map((ad) => (
              <div
                key={ad.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--color-border, #e5e7eb)",
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--color-input-text)" }}>{ad.title}</p>
                  <p style={{ fontSize: 12, color: "var(--color-sidebar-text)", marginTop: 2 }}>
                    {ad.platforms?.join(" · ")}
                  </p>
                </div>
                <CampaignStatusBadge status={ad.status} />
              </div>
            ))}
          </SectionCard>
        </div>
      )}
    </PageWithSidebar>
  );
}

/* ══════════════════════════════════════════════
   ROOT — controls which page is active
══════════════════════════════════════════════ */

export default function ReviewerDashboard() {
  const navigate          = useNavigate();
  const [ads,     setAds]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adsAPI.list().then(setAds).catch(console.error).finally(() => setLoading(false));
  }, []);

  const reviewable = ads.filter((a) => ["under_review", "strategy_created"].includes(a.status));
  const reviewed   = ads.filter((a) => ["approved", "published"].includes(a.status));

  if (loading) return null;

  return (
    <DashboardPage
      ads={ads}
      reviewable={reviewable}
      reviewed={reviewed}
      onReview={(ad) => navigate(`/reviewer/campaign/${ad.id}`)}
    />
  );
}