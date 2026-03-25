/**
 * M12b: Reviewer Campaign Detail Page
 * Owner: Frontend Dev 3
 * Dependencies: adsAPI, shared/Layout
 *
 * Route: /reviewer/campaign/:id
 *
 * Mirrors CampaignDetailPage (M11) but scoped to reviewer actions:
 *   - View strategy (read-only StrategyViewer)
 *   - Submit a verdict review (approve / revision / reject) — existing flow
 *   - Minor Edit   — inline field edit → auto audit-trail system message
 *   - AI Re-Strategy — reviewer writes instructions → full AI rewrite
 *
 * Styles: index.css classes only, no raw Tailwind color utilities.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  PageWithSidebar, SectionCard, CampaignStatusBadge,
} from "../shared/Layout";
import { adsAPI } from "../../services/api";
import {
  ArrowLeft, CheckCircle, XCircle, MessageSquare,
  Megaphone, Globe, Image, Bot, Loader2, AlertCircle,
  ChevronDown, ChevronUp, Target, DollarSign, Users,
  Layers, TrendingUp, List, Send, Pencil, Sparkles,
  RefreshCw, CheckCircle2, BarChart2, Zap, MessageCircle,
  FileText,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: "draft",            label: "Draft" },
  { key: "strategy_created", label: "Strategy Ready" },
  { key: "under_review",     label: "Under Review" },
  { key: "ethics_review",    label: "Ethics Review" },
  { key: "approved",         label: "Approved" },
  { key: "published",        label: "Published" },
];

function statusIndex(s) {
  const i = STATUS_STEPS.findIndex((x) => x.key === s);
  return i === -1 ? 0 : i;
}

function StatusTimeline({ status }) {
  const current = statusIndex(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 4 }}>
      {STATUS_STEPS.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={step.key}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: done ? "var(--color-accent)" : active ? "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.15)" : "var(--color-card-bg)",
                border: `2px solid ${done || active ? "var(--color-accent)" : "var(--color-card-border)"}`,
                transition: "all 0.2s",
              }}>
                {done
                  ? <CheckCircle2 size={13} style={{ color: "#fff" }} />
                  : <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: active ? "var(--color-accent)" : "var(--color-card-border)" }} />
                }
              </div>
              <p style={{
                fontSize: "0.65rem", fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
                color: done || active ? "var(--color-input-text)" : "var(--color-sidebar-text)",
              }}>
                {step.label}
              </p>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, minWidth: 20,
                backgroundColor: i < current ? "var(--color-accent)" : "var(--color-card-border)",
                marginBottom: 20, transition: "background-color 0.2s",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const TYPE_ICON = { website: Globe, ads: Image, voicebot: Bot, chatbot: MessageSquare };
function AdTypeChip({ type }) {
  const Icon = TYPE_ICON[type] ?? Megaphone;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 500,
      border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-card-bg)",
      color: "var(--color-input-text)",
    }}>
      <Icon size={12} style={{ color: "var(--color-accent)" }} />
      {type}
    </span>
  );
}

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

// ─── Collapsible strategy section (same as ReviewerDashboard) ─────────────────

function StrategySection({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--color-border, #e5e7eb)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", background: "var(--color-card-bg, #f9fafb)",
          border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <Icon size={15} style={{ color: "var(--color-primary, #166534)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-input-text, #111)", flex: 1 }}>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ padding: "14px 16px", background: "var(--color-surface, #fff)", fontSize: 13 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function StrategyViewer({ strategy }) {
  if (!strategy) return (
    <p style={{ fontSize: 13, color: "var(--color-sidebar-text)" }}>No strategy generated yet.</p>
  );
  const s = strategy;
  const budgetEntries = s.budget_allocation ? Object.entries(s.budget_allocation) : [];
  return (
    <div>
      <StrategySection icon={Megaphone} title="Executive Summary" defaultOpen>
        <p style={{ color: "var(--color-input-text)", lineHeight: 1.7 }}>{s.executive_summary}</p>
      </StrategySection>

      {s.target_audience && (
        <StrategySection icon={Users} title="Target Audience" defaultOpen>
          {[["PRIMARY", s.target_audience.primary], ["SECONDARY", s.target_audience.secondary], ["DEMOGRAPHICS", s.target_audience.demographics]]
            .filter(([, v]) => v)
            .map(([label, text]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", marginBottom: 4, color: "var(--color-sidebar-text)" }}>{label}</p>
                <p style={{ color: "var(--color-input-text)", lineHeight: 1.6 }}>{text}</p>
              </div>
            ))}
        </StrategySection>
      )}

      {s.messaging && (
        <StrategySection icon={MessageSquare} title="Messaging">
          {s.messaging.core_message && (
            <div style={{ background: "var(--color-primary-light, #dcfce7)", borderLeft: "3px solid var(--color-primary, #166534)", padding: "12px 16px", borderRadius: 6, marginBottom: 14, fontStyle: "italic", color: "var(--color-primary, #166534)", fontWeight: 500, lineHeight: 1.6 }}>
              "{s.messaging.core_message}"
            </div>
          )}
          {s.messaging.tone && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", marginBottom: 4, color: "var(--color-sidebar-text)" }}>TONE</p>
              <p style={{ color: "var(--color-input-text)", lineHeight: 1.6 }}>{s.messaging.tone}</p>
            </div>
          )}
          {s.messaging.key_differentiators?.length > 0 && (
            <div>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", marginBottom: 8, color: "var(--color-sidebar-text)" }}>KEY DIFFERENTIATORS</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                {s.messaging.key_differentiators.map((d, i) => (
                  <li key={i} style={{ color: "var(--color-input-text)", lineHeight: 1.6 }}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </StrategySection>
      )}

      {s.content_plan?.length > 0 && (
        <StrategySection icon={List} title={`Content Plan (${s.content_plan.length} items)`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {s.content_plan.map((item, i) => (
              <div key={i} style={{ border: "1px solid var(--color-border, #e5e7eb)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <Tag>{item.channel}</Tag>
                  <span style={{ fontSize: 11, color: "var(--color-sidebar-text)", textAlign: "right", maxWidth: "55%" }}>{item.format}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--color-sidebar-text)", marginBottom: 6 }}><strong>Frequency:</strong> {item.frequency}</p>
                {item.example && <p style={{ fontSize: 12, color: "var(--color-input-text)", lineHeight: 1.6 }}>{item.example}</p>}
              </div>
            ))}
          </div>
        </StrategySection>
      )}

      {budgetEntries.length > 0 && (
        <StrategySection icon={DollarSign} title="Budget Allocation">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {budgetEntries.map(([channel, pct]) => (
              <div key={channel}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--color-input-text)" }}>{channel}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary, #166534)" }}>{pct}</span>
                </div>
                <div style={{ height: 5, borderRadius: 10, background: "var(--color-border, #e5e7eb)", overflow: "hidden" }}>
                  <div style={{ width: pct, height: "100%", background: "var(--color-primary, #166534)", borderRadius: 10, transition: "width 0.5s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </StrategySection>
      )}

      {s.kpis?.length > 0 && (
        <StrategySection icon={TrendingUp} title={`KPIs (${s.kpis.length})`}>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {s.kpis.map((k, i) => (
              <li key={i} style={{ fontSize: 12, color: "var(--color-input-text)", lineHeight: 1.6 }}>{k}</li>
            ))}
          </ul>
        </StrategySection>
      )}
    </div>
  );
}

// ─── Verdict review panel (existing behaviour, preserved) ─────────────────────

function VerdictPanel({ adId, onSubmitted }) {
  const [form, setForm]       = useState({ review_type: "strategy", status: "approved", comments: "", suggestions: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const submit = async () => {
    if (!form.comments.trim()) { setError("Comments are required."); return; }
    setLoading(true); setError(null);
    try {
      await adsAPI.createReview(adId, form);
      onSubmitted();
    } catch (err) {
      setError(err.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontSize: "0.75rem", fontWeight: 600, color: "var(--color-sidebar-text)", display: "block", marginBottom: 6 };
  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem",
    border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-input-bg)",
    color: "var(--color-input-text)", outline: "none", boxSizing: "border-box",
  };
  const textStyle = { ...inputStyle, resize: "vertical", minHeight: 80, fontFamily: "inherit" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label style={labelStyle}>Review Type</label>
          <select style={inputStyle} value={form.review_type} onChange={(e) => setForm((p) => ({ ...p, review_type: e.target.value }))}>
            <option value="strategy">Strategy Review</option>
            <option value="ethics">Ethics Review</option>
            <option value="performance">Performance Review</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Decision</label>
          <select style={inputStyle} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="approved">Approve</option>
            <option value="revision">Request Revision</option>
            <option value="rejected">Reject</option>
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Comments *</label>
        <textarea style={textStyle} placeholder="Provide your review comments..." value={form.comments} onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))} />
      </div>
      <div>
        <label style={labelStyle}>Suggestions (optional)</label>
        <textarea style={{ ...textStyle, minHeight: 60 }} placeholder="Any specific suggestions for improvement..." value={form.suggestions} onChange={(e) => setForm((p) => ({ ...p, suggestions: e.target.value }))} />
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
          <p style={{ fontSize: "0.82rem", color: "#ef4444" }}>{error}</p>
        </div>
      )}

      <button
        onClick={submit}
        disabled={loading}
        className="btn--accent"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: loading ? 0.7 : 1 }}
      >
        {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
        Submit Review
      </button>
    </div>
  );
}

// ─── Minor Edit panel ──────────────────────────────────────────────────────────
//
// Shows a dropdown of editable top-level strategy fields.
// On save → calls adsAPI.minorEditStrategy(adId, { field, old_value, new_value })
// The backend is expected to persist the patch and append a system audit message:
//   "executive_summary changed from '<old>' to '<new>'"
//
// If adsAPI.minorEditStrategy is not yet wired, callers can temporarily stub it as:
//   adsAPI.minorEditStrategy = (id, payload) => adsAPI.createReview(id, { review_type: "minor_edit", ...payload })

const EDITABLE_FIELDS = [
  { key: "executive_summary",       label: "Executive Summary",    type: "textarea" },
  { key: "messaging.core_message",  label: "Core Message",         type: "textarea" },
  { key: "messaging.tone",          label: "Messaging Tone",       type: "text"     },
];

/** Safely reads a dot-path like "messaging.core_message" from an object */
function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, k) => (acc != null ? acc[k] : undefined), obj) ?? "";
}

function MinorEditPanel({ adId, strategy, onEdited }) {
  const [selectedField, setSelectedField] = useState(EDITABLE_FIELDS[0].key);
  const [newValue,      setNewValue]      = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [success,       setSuccess]       = useState(false);

  // When the dropdown changes, seed the textarea with the current value
  const handleFieldChange = (fieldKey) => {
    setSelectedField(fieldKey);
    setNewValue(getNestedValue(strategy, fieldKey));
    setError(null);
    setSuccess(false);
  };

  // Initialise on mount
  useEffect(() => {
    setNewValue(getNestedValue(strategy, EDITABLE_FIELDS[0].key));
  }, [strategy]);

  const currentDef   = EDITABLE_FIELDS.find((f) => f.key === selectedField);
  const currentLabel = currentDef?.label ?? selectedField;
  const oldValue     = getNestedValue(strategy, selectedField);

  const save = async () => {
    if (!newValue.trim()) { setError("New value cannot be empty."); return; }
    if (newValue.trim() === String(oldValue).trim()) { setError("No changes detected."); return; }
    setLoading(true); setError(null); setSuccess(false);
    try {
      await adsAPI.minorEditStrategy(adId, {
        field:     selectedField,
        old_value: String(oldValue),
        new_value: newValue.trim(),
      });
      setSuccess(true);
      onEdited();
    } catch (err) {
      setError(err.message || "Failed to save edit.");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontSize: "0.75rem", fontWeight: 600, color: "var(--color-sidebar-text)", display: "block", marginBottom: 6 };
  const inputBase  = {
    width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem",
    border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-input-bg)",
    color: "var(--color-input-text)", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Info callout */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, backgroundColor: "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.06)", border: "1px solid rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.2)" }}>
        <Pencil size={13} style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.78rem", color: "var(--color-sidebar-text)", lineHeight: 1.5 }}>
          Make a targeted edit to a single strategy field. The change and what it replaced will be recorded automatically in the audit trail as a system message.
        </p>
      </div>

      {/* Field selector */}
      <div>
        <label style={labelStyle}>Field to Edit</label>
        <select
          style={inputBase}
          value={selectedField}
          onChange={(e) => handleFieldChange(e.target.value)}
        >
          {EDITABLE_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Current value (read-only preview) */}
      <div>
        <label style={labelStyle}>Current Value</label>
        <div style={{
          padding: "10px 12px", borderRadius: 8, fontSize: "0.82rem",
          border: "1px solid var(--color-card-border)",
          backgroundColor: "var(--color-page-bg)",
          color: "var(--color-sidebar-text)",
          lineHeight: 1.6, whiteSpace: "pre-wrap",
          maxHeight: 120, overflowY: "auto",
        }}>
          {String(oldValue) || <em>empty</em>}
        </div>
      </div>

      {/* New value input */}
      <div>
        <label style={labelStyle}>New Value *</label>
        {currentDef?.type === "textarea" ? (
          <textarea
            style={{ ...inputBase, resize: "vertical", minHeight: 100, fontFamily: "inherit" }}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`Enter new ${currentLabel}…`}
          />
        ) : (
          <input
            type="text"
            style={inputBase}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`Enter new ${currentLabel}…`}
          />
        )}
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
          <p style={{ fontSize: "0.82rem", color: "#ef4444" }}>{error}</p>
        </div>
      )}
      {success && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <CheckCircle size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
          <p style={{ fontSize: "0.82rem", color: "#22c55e" }}>Edit saved and recorded in audit trail.</p>
        </div>
      )}

      <button
        onClick={save}
        disabled={loading}
        className="btn--accent"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: loading ? 0.7 : 1 }}
      >
        {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Pencil size={14} />}
        Save Minor Edit
      </button>
    </div>
  );
}

// ─── AI Re-Strategy panel ──────────────────────────────────────────────────────
//
// Reviewer writes freeform instructions / feedback.
// Calls adsAPI.rewriteStrategy(adId, { instructions }) → backend runs full AI rewrite.
// Backend should append a system audit message like:
//   "AI Re-Strategy triggered by reviewer: '<first 120 chars of instructions>…'"

function AIReStrategyPanel({ adId, onRewritten }) {
  const [instructions, setInstructions] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [success,      setSuccess]      = useState(false);
  const [confirmed,    setConfirmed]    = useState(false);

  const run = async () => {
    if (!instructions.trim()) { setError("Instructions are required."); return; }
    if (!confirmed) { setError("Please confirm you want to replace the current strategy."); return; }
    setLoading(true); setError(null); setSuccess(false);
    try {
      await adsAPI.rewriteStrategy(adId, { instructions: instructions.trim() });
      setSuccess(true);
      setInstructions("");
      setConfirmed(false);
      onRewritten();
    } catch (err) {
      setError(err.message || "Re-strategy failed.");
    } finally {
      setLoading(false);
    }
  };

  const labelStyle = { fontSize: "0.75rem", fontWeight: 600, color: "var(--color-sidebar-text)", display: "block", marginBottom: 6 };
  const textStyle  = {
    width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: "0.85rem",
    border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-input-bg)",
    color: "var(--color-input-text)", outline: "none", boxSizing: "border-box",
    resize: "vertical", minHeight: 130, fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Warning callout */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 8, backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}>
        <Sparkles size={14} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: "0.78rem", color: "var(--color-sidebar-text)", lineHeight: 1.5 }}>
          This will instruct Claude to <strong style={{ color: "var(--color-input-text)" }}>replace the entire strategy from scratch</strong> using your instructions as guidance. The current strategy will be overwritten. This action is recorded in the audit trail.
        </p>
      </div>

      {/* Instructions textarea */}
      <div>
        <label style={labelStyle}>Your Instructions for Claude *</label>
        <textarea
          style={textStyle}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. The current strategy over-indexes on social media. Refocus on B2B channels like LinkedIn and email with a thought-leadership angle. Reduce influencer budget to under 10%. Keep the same target audience but adjust messaging tone to be more professional."
        />
        <p style={{ fontSize: "0.7rem", color: "var(--color-sidebar-text)", marginTop: 4 }}>
          Be as specific as possible — Claude will use the original campaign brief plus your instructions to generate a new strategy.
        </p>
      </div>

      {/* Confirmation checkbox */}
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: "var(--color-accent)", cursor: "pointer" }}
        />
        <span style={{ fontSize: "0.82rem", color: "var(--color-input-text)" }}>
          I understand the current strategy will be permanently replaced
        </span>
      </label>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
          <p style={{ fontSize: "0.82rem", color: "#ef4444" }}>{error}</p>
        </div>
      )}
      {success && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <CheckCircle size={14} style={{ color: "#22c55e", flexShrink: 0 }} />
          <p style={{ fontSize: "0.82rem", color: "#22c55e" }}>AI is re-writing the strategy. Reload in a few seconds to see the result.</p>
        </div>
      )}

      <button
        onClick={run}
        disabled={loading || !confirmed}
        className="btn--accent"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: (loading || !confirmed) ? 0.6 : 1, cursor: (loading || !confirmed) ? "not-allowed" : "pointer" }}
      >
        {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
        {loading ? "Re-writing strategy… (15–30s)" : "Trigger AI Re-Strategy"}
      </button>
    </div>
  );
}

// ─── Review history card ───────────────────────────────────────────────────────

function ReviewCard({ review }) {
  const isSystem = review.review_type === "system" || review.is_system;
  const statusColor = {
    approved: "var(--color-success)",
    rejected: "#ef4444",
    revision: "#f59e0b",
    pending:  "var(--color-sidebar-text)",
  }[review.status] ?? "var(--color-sidebar-text)";

  if (isSystem) {
    return (
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px", borderRadius: 8,
        border: "1px dashed var(--color-card-border)",
        backgroundColor: "var(--color-page-bg)",
      }}>
        <RefreshCw size={13} style={{ color: "var(--color-sidebar-text)", flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: "0.78rem", color: "var(--color-sidebar-text)", lineHeight: 1.6, fontStyle: "italic" }}>
            {review.comments}
          </p>
          {review.created_at && (
            <p style={{ fontSize: "0.68rem", color: "var(--color-sidebar-text)", marginTop: 4 }}>
              {new Date(review.created_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-card-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, textTransform: "capitalize", backgroundColor: statusColor + "22", color: statusColor, border: `1px solid ${statusColor}44` }}>
            {review.status}
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--color-sidebar-text)", textTransform: "capitalize" }}>
            {review.review_type} review
          </span>
        </div>
        {review.created_at && (
          <span style={{ fontSize: "0.7rem", color: "var(--color-sidebar-text)" }}>
            {new Date(review.created_at).toLocaleDateString()}
          </span>
        )}
      </div>
      {review.comments && <p style={{ fontSize: "0.82rem", color: "var(--color-input-text)", lineHeight: 1.6 }}>{review.comments}</p>}
      {review.suggestions && <p style={{ fontSize: "0.78rem", color: "var(--color-sidebar-text)", marginTop: 6, fontStyle: "italic" }}>Suggestions: {review.suggestions}</p>}
    </div>
  );
}

// ─── Tab bar used inside the action column ─────────────────────────────────────

const ACTION_TABS = [
  { key: "verdict",    label: "Verdict",     icon: CheckCircle },
  { key: "minor_edit", label: "Minor Edit",  icon: Pencil      },
  { key: "restrategy", label: "Re-Strategy", icon: Sparkles    },
];

function ActionTabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid var(--color-card-border)", marginBottom: 20 }}>
      {ACTION_TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 14px", border: "none", background: "none",
            cursor: "pointer", fontSize: "0.8rem", fontWeight: active === key ? 700 : 500,
            color: active === key ? "var(--color-accent)" : "var(--color-sidebar-text)",
            borderBottom: active === key ? "2px solid var(--color-accent)" : "2px solid transparent",
            marginBottom: -1, transition: "color 0.15s",
          }}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main exported component ───────────────────────────────────────────────────

export default function ReviewerCampaignDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [ad,       setAd]       = useState(null);
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [activeTab, setActiveTab] = useState("verdict");

  const load = useCallback(async () => {
    try {
      const [adData, reviewsData] = await Promise.all([
        adsAPI.get(id),
        adsAPI.listReviews(id),
      ]);
      setAd(adData);
      setReviews(reviewsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleActionDone = async () => { await load(); };

  if (loading) return (
    <PageWithSidebar>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 0", color: "var(--color-sidebar-text)" }}>
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        <p>Loading campaign…</p>
      </div>
    </PageWithSidebar>
  );

  if (error || !ad) return (
    <PageWithSidebar>
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <AlertCircle size={32} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--color-input-text)", fontWeight: 600 }}>Campaign not found</p>
        <p style={{ color: "var(--color-sidebar-text)", fontSize: "0.85rem", marginTop: 4 }}>{error}</p>
        <button onClick={() => navigate(-1)} className="btn--ghost" style={{ marginTop: 16 }}>Go back</button>
      </div>
    </PageWithSidebar>
  );

  const hasStrategy = statusIndex(ad.status) >= statusIndex("strategy_created");
  const canAct      = ["under_review", "strategy_created", "ethics_review"].includes(ad.status);

  return (
    <PageWithSidebar>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Header ── */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", border: "1px solid var(--color-border, #e5e7eb)",
            borderRadius: 8, background: "transparent", cursor: "pointer",
            fontSize: 13, color: "var(--color-input-text)", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-header__title">{ad.title}</h1>
          <p className="page-header__subtitle">Campaign review</p>
        </div>
        <CampaignStatusBadge status={ad.status} />
      </div>

      {/* ── Meta chips ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div className="info-tile" style={{ minWidth: 120 }}>
          <p className="info-tile__label">Budget</p>
          <p className="info-tile__value">${ad.budget?.toLocaleString() || "N/A"}</p>
        </div>
        <div className="info-tile" style={{ flex: 1 }}>
          <p className="info-tile__label">Platforms</p>
          <p className="info-tile__value" style={{ fontSize: 13 }}>{ad.platforms?.join(" · ") || "None"}</p>
        </div>
        <div className="info-tile" style={{ minWidth: 100 }}>
          <p className="info-tile__label">Ad Type</p>
          <p className="info-tile__value">{ad.ad_type?.join(", ") || "—"}</p>
        </div>
      </div>

      {/* ── Status timeline ── */}
      <div style={{ marginBottom: 24 }}>
        <SectionCard title="Campaign Progress">
          <StatusTimeline status={ad.status} />
        </SectionCard>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

        {/* Left: full strategy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <SectionCard title="AI Generated Strategy" subtitle="Expand each section to review">
            {hasStrategy
              ? <StrategyViewer strategy={ad.strategy_json} />
              : <p style={{ fontSize: 13, color: "var(--color-sidebar-text)" }}>Strategy not yet generated for this campaign.</p>
            }
          </SectionCard>

          {/* Review history */}
          {reviews.length > 0 && (
            <SectionCard
              title="Audit Trail"
              subtitle={`${reviews.length} entr${reviews.length !== 1 ? "ies" : "y"}`}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right: sticky action column */}
        <div style={{ position: "sticky", top: 24 }}>
          <SectionCard title="Reviewer Actions">
            {!canAct ? (
              <p style={{ fontSize: "0.82rem", color: "var(--color-sidebar-text)" }}>
                This campaign is currently <strong>{ad.status}</strong> and does not require reviewer action.
              </p>
            ) : (
              <>
                <ActionTabs active={activeTab} onChange={setActiveTab} />

                {activeTab === "verdict" && (
                  <VerdictPanel adId={id} onSubmitted={handleActionDone} />
                )}

                {activeTab === "minor_edit" && (
                  hasStrategy
                    ? <MinorEditPanel adId={id} strategy={ad.strategy_json} onEdited={handleActionDone} />
                    : <p style={{ fontSize: "0.82rem", color: "var(--color-sidebar-text)" }}>Strategy must be generated before making edits.</p>
                )}

                {activeTab === "restrategy" && (
                  hasStrategy
                    ? <AIReStrategyPanel adId={id} onRewritten={handleActionDone} />
                    : <p style={{ fontSize: "0.82rem", color: "var(--color-sidebar-text)" }}>Strategy must be generated before triggering a re-write.</p>
                )}
              </>
            )}
          </SectionCard>
        </div>

      </div>

      {/* Reload */}
      <div style={{ paddingBottom: 32, paddingTop: 8, display: "flex", gap: 10 }}>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="btn--ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
        <button onClick={() => navigate(-1)} className="btn--ghost">Back</button>
      </div>

    </PageWithSidebar>
  );
}