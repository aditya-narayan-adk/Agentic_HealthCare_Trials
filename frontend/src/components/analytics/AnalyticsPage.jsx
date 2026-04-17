/**
 * M15: Analytics Page — Study Coordinator view
 * Shows participant enrollment, eligibility funnel, demographics, and
 * ad performance for each published campaign.
 */

import React, { useState, useEffect } from "react";
import { PageWithSidebar, SectionCard, MetricSummaryCard } from "../shared/Layout";
import { adsAPI, analyticsAPI, surveyAPI } from "../../services/api";
import {
  BarChart3, Users, CheckCircle2, XCircle, Target,
  Phone, MousePointer, RefreshCw, Loader2, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n, decimals = 0) =>
  n == null || isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals });

const pct = (num, den) =>
  den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—";

const ACCENT    = "var(--color-accent)";
const MUTED     = "var(--color-sidebar-text)";
const CARD_BG   = "var(--color-card-bg)";
const CARD_BORDER = "var(--color-card-border)";

const tooltipStyle = {
  backgroundColor: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 8,
  fontSize: "0.78rem",
};

const axisStyle = { fontSize: 10, fill: MUTED };

// Age grouping
function ageGroup(age) {
  if (age <= 30) return "18–30";
  if (age <= 45) return "31–45";
  if (age <= 60) return "46–60";
  return "60+";
}

function buildAgeData(responses) {
  const groups = { "18–30": 0, "31–45": 0, "46–60": 0, "60+": 0 };
  for (const r of responses) {
    const g = ageGroup(r.age);
    if (g in groups) groups[g]++;
  }
  return Object.entries(groups).map(([group, count]) => ({ group, count }));
}

function buildSexData(responses) {
  const counts = {};
  for (const r of responses) {
    const label = r.sex === "prefer_not_to_say" ? "Not specified" :
                  r.sex.charAt(0).toUpperCase() + r.sex.slice(1);
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts).map(([sex, count]) => ({ sex, count }));
}

function buildEnrollmentOverTime(responses) {
  const byDate = {};
  for (const r of responses) {
    const d = r.created_at?.slice(0, 10);
    if (!d) continue;
    byDate[d] = byDate[d] || { date: d, total: 0, eligible: 0 };
    byDate[d].total++;
    if (r.is_eligible) byDate[d].eligible++;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [ads,             setAds]             = useState([]);
  const [selected,        setSelected]        = useState(null);
  const [responses,       setResponses]       = useState([]);
  const [analytics,       setAnalytics]       = useState([]);
  const [voiceSessions,   setVoiceSessions]   = useState([]);
  const [loadingPage,     setLoadingPage]     = useState(true);
  const [loadingData,     setLoadingData]     = useState(false);

  useEffect(() => {
    adsAPI.list("published")
      .then((data) => {
        setAds(data);
        if (data.length > 0) loadCampaign(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoadingPage(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCampaign = async (ad) => {
    setSelected(ad);
    setLoadingData(true);
    setResponses([]);
    setAnalytics([]);
    setVoiceSessions([]);
    const [r, a, v] = await Promise.allSettled([
      surveyAPI.list(ad.id),
      analyticsAPI.get(ad.id),
      adsAPI.listVoiceConversations(ad.id, 100),
    ]);
    setResponses(r.status === "fulfilled" ? (r.value || []) : []);
    setAnalytics(a.status === "fulfilled" ? (a.value || []) : []);
    setVoiceSessions(v.status === "fulfilled" ? (v.value?.conversations || []) : []);
    setLoadingData(false);
  };

  // ── derived metrics ──────────────────────────────────────────────────────

  const totalResponses = responses.length;
  const eligible       = responses.filter((r) => r.is_eligible === true).length;
  const ineligible     = responses.filter((r) => r.is_eligible === false).length;
  const pending        = totalResponses - eligible - ineligible;
  const target         = selected?.patients_required || 0;

  // Ad analytics totals (Meta-sourced rows preferred, else all)
  const metaRows     = analytics.filter((a) => a.source === "meta");
  const analyticsRows = metaRows.length > 0 ? metaRows : analytics;
  const totalImps    = analyticsRows.reduce((s, a) => s + (a.impressions || 0), 0);
  const avgCtr       = analyticsRows.length > 0
    ? analyticsRows.reduce((s, a) => s + (a.click_rate || 0), 0) / analyticsRows.length
    : 0;
  const estimatedClicks = Math.round(totalImps * avgCtr / 100);

  // Voice
  const voiceCount  = voiceSessions.length;
  const avgDuration = voiceSessions.length > 0
    ? voiceSessions.reduce((s, v) => s + (v.duration_seconds || 0), 0) / voiceSessions.length
    : 0;

  // Charts
  const funnelData = [
    { stage: "Impressions",  value: totalImps,       fill: "#6366f1" },
    { stage: "Est. Clicks",  value: estimatedClicks, fill: "#8b5cf6" },
    { stage: "Responses",    value: totalResponses,  fill: "#22c55e" },
    { stage: "Eligible",     value: eligible,        fill: "#16a34a" },
  ].filter((d) => d.value > 0 || d.stage === "Responses");

  const ageData        = buildAgeData(responses);
  const sexData        = buildSexData(responses);
  const enrollmentTime = buildEnrollmentOverTime(responses);

  const SEX_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899"];

  // ── render ───────────────────────────────────────────────────────────────

  if (loadingPage) {
    return (
      <PageWithSidebar>
        <div className="empty-state">
          <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: MUTED }} />
        </div>
      </PageWithSidebar>
    );
  }

  return (
    <PageWithSidebar>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Enrollment Analytics</h1>
          <p className="page-header__subtitle">
            Participant recruitment, eligibility, and campaign performance
          </p>
        </div>
        {selected && (
          <button
            className="btn--outline"
            onClick={() => loadCampaign(selected)}
            disabled={loadingData}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {loadingData
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <RefreshCw size={13} />}
            Refresh
          </button>
        )}
      </div>

      {/* Campaign selector */}
      {ads.length > 0 ? (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {ads.map((ad) => (
            <button
              key={ad.id}
              onClick={() => loadCampaign(ad)}
              className={selected?.id === ad.id
                ? "filter-tab--active whitespace-nowrap"
                : "filter-tab whitespace-nowrap"}
            >
              {ad.title}
            </button>
          ))}
        </div>
      ) : (
        <SectionCard>
          <div className="empty-state">
            <BarChart3 size={48} className="empty-state__icon" />
            <p className="empty-state__text">No published campaigns to analyze</p>
          </div>
        </SectionCard>
      )}

      {selected && (
        loadingData ? (
          <div className="empty-state" style={{ minHeight: 200 }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: MUTED }} />
          </div>
        ) : (
          <>
            {/* ── KPI row ── */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <MetricSummaryCard
                label="Participants"
                value={fmt(totalResponses)}
                icon={Users}
              />
              <MetricSummaryCard
                label="Eligible"
                value={fmt(eligible)}
                icon={CheckCircle2}
              />
              <MetricSummaryCard
                label="Ineligible"
                value={fmt(ineligible)}
                icon={XCircle}
              />
              <MetricSummaryCard
                label="Eligibility Rate"
                value={pct(eligible, totalResponses)}
                icon={TrendingUp}
              />
              <MetricSummaryCard
                label={target ? `Target: ${fmt(target)}` : "Enrollment Progress"}
                value={target ? pct(eligible, target) : `${fmt(eligible)} enrolled`}
                icon={Target}
              />
            </div>

            {/* ── Enrollment target progress bar ── */}
            {target > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--color-input-text)" }}>
                    Enrollment Progress
                  </span>
                  <span style={{ color: MUTED }}>
                    {eligible} / {target} participants
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 999, backgroundColor: "var(--color-page-bg)", border: `1px solid ${CARD_BORDER}`, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min((eligible / target) * 100, 100)}%`,
                    background: "linear-gradient(90deg, var(--color-accent), #22c55e)",
                    borderRadius: 999,
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: "0.72rem", color: MUTED }}>
                  <span style={{ color: "#22c55e" }}>■ Eligible: {eligible}</span>
                  {pending > 0 && <span style={{ color: "#f59e0b" }}>■ Pending review: {pending}</span>}
                  <span>■ Ineligible: {ineligible}</span>
                </div>
              </div>
            )}

            {/* ── Funnel + Demographics ── */}
            <div className="grid grid-cols-2 gap-6 mb-6">

              {/* Recruitment Funnel */}
              <SectionCard
                title="Recruitment Funnel"
                subtitle="Traffic → responses → eligible participants"
              >
                {funnelData.length === 0 || (totalImps === 0 && totalResponses === 0) ? (
                  <p style={{ fontSize: "0.83rem", color: MUTED, padding: "24px 0", textAlign: "center" }}>
                    No data yet — sync Meta insights and wait for survey responses
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={funnelData}
                      layout="vertical"
                      margin={{ top: 4, right: 40, left: 16, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CARD_BORDER} horizontal={false} />
                      <XAxis type="number" tick={axisStyle} />
                      <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: "var(--color-input-text)" }} width={90} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Count">
                        {funnelData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Conversion rates below funnel */}
                {totalImps > 0 && totalResponses > 0 && (
                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: "0.72rem", color: MUTED, flexWrap: "wrap" }}>
                    <span>Click rate: <strong style={{ color: "var(--color-input-text)" }}>{avgCtr.toFixed(2)}%</strong></span>
                    <span>Response rate: <strong style={{ color: "var(--color-input-text)" }}>{pct(totalResponses, estimatedClicks || 1)}</strong></span>
                    <span>Eligibility: <strong style={{ color: "#16a34a" }}>{pct(eligible, totalResponses)}</strong></span>
                  </div>
                )}
              </SectionCard>

              {/* Demographics */}
              <SectionCard
                title="Participant Demographics"
                subtitle="Age and sex distribution of respondents"
              >
                {totalResponses === 0 ? (
                  <p style={{ fontSize: "0.83rem", color: MUTED, padding: "24px 0", textAlign: "center" }}>
                    No survey responses yet
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Age groups */}
                    <div>
                      <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 6 }}>
                        Age Distribution
                      </p>
                      <ResponsiveContainer width="100%" height={110}>
                        <BarChart data={ageData} margin={{ top: 2, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CARD_BORDER} />
                          <XAxis dataKey="group" tick={axisStyle} />
                          <YAxis tick={axisStyle} allowDecimals={false} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="count" fill="rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.75)" radius={[4, 4, 0, 0]} name="Participants" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Sex breakdown */}
                    <div>
                      <p style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 6 }}>
                        Sex
                      </p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {sexData.map((d, i) => (
                          <div key={d.sex} style={{
                            padding: "6px 14px", borderRadius: 999, fontSize: "0.78rem", fontWeight: 600,
                            backgroundColor: `${SEX_COLORS[i % SEX_COLORS.length]}18`,
                            border: `1px solid ${SEX_COLORS[i % SEX_COLORS.length]}40`,
                            color: SEX_COLORS[i % SEX_COLORS.length],
                          }}>
                            {d.sex}: {d.count} ({pct(d.count, totalResponses)})
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            {/* ── Enrollment over time + Voice ── */}
            <div className="grid grid-cols-3 gap-6 mb-6">

              {/* Enrollment timeline */}
              <div style={{ gridColumn: "span 2" }}>
                <SectionCard
                  title="Enrollment Over Time"
                  subtitle="Daily participant submissions"
                >
                  {enrollmentTime.length === 0 ? (
                    <p style={{ fontSize: "0.83rem", color: MUTED, padding: "24px 0", textAlign: "center" }}>
                      No submissions yet
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={enrollmentTime} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CARD_BORDER} />
                        <XAxis dataKey="date" tick={axisStyle} />
                        <YAxis tick={axisStyle} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line type="monotone" dataKey="total"    stroke="#6366f1" strokeWidth={2} dot={false} name="Responses" />
                        <Line type="monotone" dataKey="eligible" stroke="#22c55e" strokeWidth={2} dot={false} name="Eligible" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>
              </div>

              {/* Voice engagement */}
              <SectionCard
                title="Voice Engagement"
                subtitle="Voicebot call activity"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "8px 0" }}>
                  <div style={{ textAlign: "center" }}>
                    <Phone size={28} style={{ color: ACCENT, marginBottom: 6 }} />
                    <p style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--color-input-text)", lineHeight: 1 }}>
                      {fmt(voiceCount)}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: MUTED, marginTop: 4 }}>Total Calls</p>
                  </div>
                  {voiceCount > 0 && (
                    <div style={{ textAlign: "center", paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
                      <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-input-text)", lineHeight: 1 }}>
                        {Math.round(avgDuration)}s
                      </p>
                      <p style={{ fontSize: "0.75rem", color: MUTED, marginTop: 4 }}>Avg Duration</p>
                    </div>
                  )}
                  {voiceCount > 0 && (
                    <div style={{ textAlign: "center", paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}` }}>
                      <p style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-input-text)", lineHeight: 1 }}>
                        {pct(voiceSessions.filter((v) => v.status === "ended").length, voiceCount)}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: MUTED, marginTop: 4 }}>Completion Rate</p>
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* ── Ad performance summary ── */}
            <SectionCard
              title="Ad Performance"
              subtitle="Aggregated metrics from Meta and internal tracking"
            >
              {analyticsRows.length === 0 ? (
                <p style={{ fontSize: "0.83rem", color: MUTED }}>
                  No performance data yet. Sync Meta insights from the Analytics tab or wait for traffic.
                </p>
              ) : (
                <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                  {[
                    { label: "Impressions",  value: fmt(totalImps) },
                    { label: "Est. Clicks",  value: fmt(estimatedClicks) },
                    { label: "Avg CTR",      value: `${avgCtr.toFixed(2)}%` },
                    { label: "Total Spend",  value: `$${fmt(analyticsRows.reduce((s, a) => s + (a.spend || 0), 0), 2)}` },
                    { label: "Avg CPM",      value: `$${fmt(analyticsRows.reduce((s, a) => s + (a.cpm || 0), 0) / (analyticsRows.length || 1), 2)}` },
                    { label: "Data Days",    value: fmt(analyticsRows.filter((a) => a.date_label).length) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ minWidth: 100 }}>
                      <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: MUTED, marginBottom: 2 }}>
                        {label}
                      </p>
                      <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-input-text)" }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )
      )}
    </PageWithSidebar>
  );
}
