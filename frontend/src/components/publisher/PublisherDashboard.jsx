/**
 * M14: Publisher Dashboard
 * Owner: Frontend Dev 2
 * Dependencies: adsAPI, analyticsAPI
 *
 * Publish reviewed strategies, create ads/websites,
 * configure voice/chatbot params, view analytics,
 * and implement optimizer suggestions.
 * Styles: use classes from index.css only — no raw Tailwind color utilities.
 */

import React, { useState, useEffect } from "react";
import { PageWithSidebar, SectionCard, MetricSummaryCard, CampaignStatusBadge } from "../shared/Layout";
import { adsAPI, analyticsAPI } from "../../services/api";
import {
  Send, Globe, Image, Bot, BarChart3, Play, Sparkles,
  CheckCircle, Rocket, ChevronDown, ChevronUp, Zap, X, ImageOff,
} from "lucide-react";

// ad_type comes back from the API as string[] — use this helper throughout.
const hasType = (ad, type) => Array.isArray(ad.ad_type) ? ad.ad_type.includes(type) : ad.ad_type === type;
const typeLabel = (ad) => (Array.isArray(ad.ad_type) ? ad.ad_type : [ad.ad_type]).join(", ");

export default function PublisherDashboard() {
  const [ads,        setAds]        = useState([]);
  const [tab,        setTab]        = useState("overview");
  const [loading,    setLoading]    = useState(true);
  const [publishing, setPublishing] = useState(null);
  const [generating, setGenerating] = useState(null); // { id, type: "website"|"creatives" }
  const [expandedId, setExpandedId] = useState(null);
  const [previewAd,  setPreviewAd]  = useState(null); // ad whose creatives are being previewed

  useEffect(() => {
    adsAPI.list().then(setAds).catch(console.error).finally(() => setLoading(false));
  }, []);

  const approved  = ads.filter((a) => a.status === "approved");
  const published = ads.filter((a) => a.status === "published");

  const handlePublish = async (adId) => {
    setPublishing(adId);
    try {
      const updated = await adsAPI.publish(adId);
      setAds((p) => p.map((a) => (a.id === adId ? updated : a)));
    } catch (err) { alert(err.message); }
    finally { setPublishing(null); }
  };

  const handleGenerateCreatives = async (adId) => {
    setGenerating({ id: adId, type: "creatives" });
    try {
      const updated = await adsAPI.generateCreatives(adId);
      setAds((p) => p.map((a) => (a.id === adId ? updated : a)));
    } catch (err) { alert(err.message); }
    finally { setGenerating(null); }
  };

  const handleGenerateWebsite = async (adId) => {
    setGenerating({ id: adId, type: "website" });
    try {
      const updated = await adsAPI.generateWebsite(adId);
      setAds((p) => p.map((a) => (a.id === adId ? updated : a)));
    } catch (err) { alert(err.message); }
    finally { setGenerating(null); }
  };

  const toggleExpanded = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const TABS = [
    { key: "overview",  label: "Overview",       icon: Send },
    { key: "ads",       label: "Ad Creator",      icon: Image },
    { key: "website",   label: "Website Creator", icon: Globe },
    { key: "bots",      label: "Bot Config",      icon: Bot },
    { key: "analytics", label: "Analytics",       icon: BarChart3 },
  ];

  if (loading) return (
    <PageWithSidebar>
      <div className="flex items-center justify-center py-40">
        <div className="spinner--dark" />
      </div>
    </PageWithSidebar>
  );

  return (
    <PageWithSidebar>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Publisher Dashboard</h1>
          <p className="page-header__subtitle">Publish campaigns, create outputs, and manage deployments</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricSummaryCard label="Ready to Publish" value={approved.length}                                        icon={Send} />
        <MetricSummaryCard label="Published"         value={published.length}                                       icon={Globe} />
        <MetricSummaryCard label="Total Campaigns"   value={ads.length}                                             icon={BarChart3} />
        <MetricSummaryCard label="Active"            value={published.filter((a) => a.status !== "paused").length} icon={Play} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`${tab === t.key ? "filter-tab--active" : "filter-tab"} flex items-center gap-1.5`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="space-y-4">

          {/* Ready to Publish */}
          <SectionCard
            title="Ready to Publish"
            subtitle={
              approved.length > 0
                ? `${approved.length} campaign${approved.length !== 1 ? "s" : ""} awaiting deployment — click a row to inspect`
                : "All campaigns are up to date"
            }
          >
            {approved.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="metric-tile__icon-wrap" style={{ width: 48, height: 48 }}>
                  <Rocket size={20} style={{ color: "var(--color-sidebar-text)" }} />
                </div>
                <p className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
                  No campaigns are waiting to be published
                </p>
              </div>
            ) : (
              <div>
                {approved.map((ad) => (
                  <div key={ad.id}>
                    <div
                      className="pub-campaign-row"
                      style={{ cursor: "pointer", borderBottomLeftRadius: expandedId === ad.id ? 0 : undefined, borderBottomRightRadius: expandedId === ad.id ? 0 : undefined }}
                      onClick={() => toggleExpanded(ad.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="pub-campaign-row__dot" />
                        <div>
                          <p className="table-row__title">{ad.title}</p>
                          <p className="table-row__meta">
                            {typeLabel(ad)} · Budget: ${ad.budget != null ? Number(ad.budget).toLocaleString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {expandedId === ad.id
                          ? <ChevronUp size={14} style={{ color: "var(--color-sidebar-text)" }} />
                          : <ChevronDown size={14} style={{ color: "var(--color-sidebar-text)" }} />
                        }
                        <button
                          onClick={() => handlePublish(ad.id)}
                          disabled={publishing === ad.id}
                          className="btn--publish"
                        >
                          {publishing === ad.id
                            ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Publishing…</>
                            : <><Send size={13} /> Publish</>
                          }
                        </button>
                      </div>
                    </div>

                    {expandedId === ad.id && (
                      <CampaignDetailPanel ad={ad} generating={generating} onGenerateCreatives={handleGenerateCreatives} onGenerateWebsite={handleGenerateWebsite} onPreviewAd={setPreviewAd} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Published Campaigns */}
          <SectionCard
            title="Published Campaigns"
            subtitle={`${published.length} live deployment${published.length !== 1 ? "s" : ""}`}
          >
            {published.length === 0 ? (
              <p className="text-sm py-4" style={{ color: "var(--color-sidebar-text)" }}>
                No published campaigns yet
              </p>
            ) : (
              <div>
                {published.map((ad) => (
                  <div key={ad.id}>
                    <div
                      className="pub-campaign-row"
                      style={{ cursor: "pointer", borderBottomLeftRadius: expandedId === ad.id ? 0 : undefined, borderBottomRightRadius: expandedId === ad.id ? 0 : undefined }}
                      onClick={() => toggleExpanded(ad.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="pub-campaign-row__dot--live" />
                        <div>
                          <p className="table-row__title">{ad.title}</p>
                          <p className="table-row__meta">{typeLabel(ad)} · {ad.output_url || "Deployed"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedId === ad.id
                          ? <ChevronUp size={14} style={{ color: "var(--color-sidebar-text)" }} />
                          : <ChevronDown size={14} style={{ color: "var(--color-sidebar-text)" }} />
                        }
                        <CampaignStatusBadge status={ad.status} />
                      </div>
                    </div>

                    {expandedId === ad.id && (
                      <CampaignDetailPanel ad={ad} generating={generating} onGenerateCreatives={handleGenerateCreatives} onGenerateWebsite={handleGenerateWebsite} onPreviewAd={setPreviewAd} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>
      )}

      {/* ── Ad Creator ── */}
      {tab === "ads" && (
        <SectionCard title="Advertisement Creator" subtitle="Preview, regenerate, and manage ad platform API keys">
          <div className="space-y-4">
            {ads.filter((a) => hasType(a, "ads")).map((ad) => {
              const isGenerating = generating?.id === ad.id && generating?.type === "creatives";
              return (
                <div key={ad.id} className="rounded-lg border p-4" style={{ borderColor: "var(--color-card-border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-input-text)" }}>{ad.title}</p>
                    <CampaignStatusBadge status={ad.status} />
                  </div>

                  {/* Reviewer ad details (spec) — shown as context if available */}
                  {ad.ad_details && (
                    <div className="mb-3">
                      <p className="pub-campaign-detail__section-label">Reviewer Ad Spec</p>
                      <div className="code-preview">
                        <pre>{JSON.stringify(ad.ad_details, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {/* Publisher-generated creative output */}
                  {ad.output_files && ad.output_files.length > 0 ? (
                    <>
                      <p className="pub-campaign-detail__section-label">Generated Creatives</p>
                      <div className="code-preview mb-3">
                        <pre>{JSON.stringify(ad.output_files, null, 2)}</pre>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn--inline-action--accent" onClick={() => setPreviewAd(ad)}>Preview Ad</button>
                        <button className="btn--inline-action--ghost" disabled={isGenerating}
                          onClick={() => handleGenerateCreatives(ad.id)}>
                          {isGenerating ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</> : "Regenerate"}
                        </button>
                        <button className="btn--inline-action--ghost">API Keys</button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 py-1">
                      <p className="text-sm flex-1" style={{ color: "var(--color-sidebar-text)" }}>
                        Ad creatives not generated yet
                      </p>
                      <button className="btn--inline-action--accent" disabled={isGenerating}
                        onClick={() => handleGenerateCreatives(ad.id)}>
                        {isGenerating
                          ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</>
                          : <><Zap size={12} /> Generate Creatives</>
                        }
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {ads.filter((a) => hasType(a, "ads")).length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
                No ad campaigns found
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Website Creator ── */}
      {tab === "website" && (
        <SectionCard title="Website Creator" subtitle="Preview, deploy, and redesign marketing websites">
          <div className="space-y-4">
            {ads.filter((a) => hasType(a, "website")).map((ad) => {
              const isGenerating = generating?.id === ad.id && generating?.type === "website";
              return (
                <div key={ad.id} className="rounded-lg border p-4" style={{ borderColor: "var(--color-card-border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-input-text)" }}>{ad.title}</p>
                    <CampaignStatusBadge status={ad.status} />
                  </div>

                  {/* Reviewer website requirements (spec) — shown as context if available */}
                  {ad.website_reqs && (
                    <div className="mb-3">
                      <p className="pub-campaign-detail__section-label">Reviewer Website Spec</p>
                      <div className="code-preview">
                        <pre>{JSON.stringify(ad.website_reqs, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {/* Publisher-generated website output */}
                  {ad.output_url ? (
                    <div className="flex gap-2 mt-1">
                      <a href={adsAPI.websitePreviewUrl(ad.id)} target="_blank" rel="noreferrer"
                        className="btn--inline-action--success">
                        Preview Website
                      </a>
                      <a href={adsAPI.websiteDownloadUrl(ad.id)} className="btn--inline-action--ghost">
                        Download HTML
                      </a>
                      <button className="btn--inline-action--ghost" disabled={isGenerating}
                        onClick={() => handleGenerateWebsite(ad.id)}>
                        {isGenerating ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</> : "Regenerate"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-1">
                      <p className="text-sm flex-1" style={{ color: "var(--color-sidebar-text)" }}>
                        Website not generated yet
                      </p>
                      <button className="btn--inline-action--success" disabled={isGenerating}
                        onClick={() => handleGenerateWebsite(ad.id)}>
                        {isGenerating
                          ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</>
                          : <><Zap size={12} /> Generate Website</>
                        }
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {ads.filter((a) => hasType(a, "website")).length === 0 && (
              <p className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
                No website campaigns found
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── Bot Config ── */}
      {tab === "bots" && (
        <BotConfig ads={ads.filter((a) => hasType(a, "voicebot") || hasType(a, "chatbot"))} />
      )}

      {/* ── Analytics ── */}
      {tab === "analytics" && <PublisherAnalytics ads={published} />}

      {/* ── Ad Preview Modal ── */}
      {previewAd && (
        <AdPreviewModal ad={previewAd} onClose={() => setPreviewAd(null)} />
      )}
    </PageWithSidebar>
  );
}

// ─── Campaign Detail Panel ─────────────────────────────────────────────────────

function CampaignDetailPanel({ ad, generating, onGenerateCreatives, onGenerateWebsite, onPreviewAd }) {
  const hasStrategy = ad.strategy_json && Object.keys(ad.strategy_json).length > 0;
  const isWebsite   = hasType(ad, "website");
  const isAds       = hasType(ad, "ads");
  const generatingWebsite   = generating?.id === ad.id && generating?.type === "website";
  const generatingCreatives = generating?.id === ad.id && generating?.type === "creatives";

  return (
    <div className="pub-campaign-detail">

      {/* Strategy */}
      {hasStrategy ? (
        <div className="mb-4">
          <p className="pub-campaign-detail__section-label">Marketing Strategy</p>
          <div className="code-preview">
            <pre>{JSON.stringify(ad.strategy_json, null, 2)}</pre>
          </div>
        </div>
      ) : (
        <p className="text-xs mb-4" style={{ color: "var(--color-sidebar-text)" }}>No strategy generated yet</p>
      )}

      {/* Website section */}
      {isWebsite && (
        <div className="mb-4">
          {/* Reviewer spec — informational */}
          {ad.website_reqs && (
            <>
              <p className="pub-campaign-detail__section-label">Reviewer Website Spec</p>
              <div className="code-preview mb-3">
                <pre>{JSON.stringify(ad.website_reqs, null, 2)}</pre>
              </div>
            </>
          )}
          {/* Publisher output — output_url set after generate-website */}
          <p className="pub-campaign-detail__section-label">Generated Website</p>
          {ad.output_url ? (
            <div className="flex gap-2">
              <a href={adsAPI.websitePreviewUrl(ad.id)} target="_blank" rel="noreferrer"
                className="btn--inline-action--success">
                Preview Website
              </a>
              <a href={adsAPI.websiteDownloadUrl(ad.id)} className="btn--inline-action--ghost">
                Download HTML
              </a>
              <button className="btn--inline-action--ghost" disabled={generatingWebsite}
                onClick={() => onGenerateWebsite(ad.id)}>
                {generatingWebsite ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</> : "Regenerate"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs flex-1" style={{ color: "var(--color-sidebar-text)" }}>
                Website not generated yet
              </p>
              <button className="btn--inline-action--success" disabled={generatingWebsite}
                onClick={() => onGenerateWebsite(ad.id)}>
                {generatingWebsite
                  ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</>
                  : <><Zap size={12} /> Generate Website</>
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ad creatives section */}
      {isAds && (
        <div className="mb-4">
          {/* Reviewer spec — informational */}
          {ad.ad_details && (
            <>
              <p className="pub-campaign-detail__section-label">Reviewer Ad Spec</p>
              <div className="code-preview mb-3">
                <pre>{JSON.stringify(ad.ad_details, null, 2)}</pre>
              </div>
            </>
          )}
          {/* Publisher output — output_files set after generate-creatives */}
          <p className="pub-campaign-detail__section-label">Generated Creatives</p>
          {ad.output_files && ad.output_files.length > 0 ? (
            <div>
              <div className="code-preview mb-2">
                <pre>{JSON.stringify(ad.output_files, null, 2)}</pre>
              </div>
              <div className="flex gap-2">
                <button className="btn--inline-action--accent" onClick={() => onPreviewAd(ad)}>Preview Ad</button>
                <button className="btn--inline-action--ghost" disabled={generatingCreatives}
                  onClick={() => onGenerateCreatives(ad.id)}>
                  {generatingCreatives ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</> : "Regenerate"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs flex-1" style={{ color: "var(--color-sidebar-text)" }}>
                Ad creatives not generated yet
              </p>
              <button className="btn--inline-action--accent" disabled={generatingCreatives}
                onClick={() => onGenerateCreatives(ad.id)}>
                {generatingCreatives
                  ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</>
                  : <><Zap size={12} /> Generate Creatives</>
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* Review notes */}
      {ad.review_notes && (
        <div>
          <p className="pub-campaign-detail__section-label">Review Notes</p>
          <p className="text-xs" style={{ color: "var(--color-input-text)" }}>{ad.review_notes}</p>
        </div>
      )}

    </div>
  );
}

// ─── Ad Preview Modal ─────────────────────────────────────────────────────────

function AdPreviewModal({ ad, onClose }) {
  const creatives = ad.output_files || [];

  return (
    <div className="ad-preview-overlay" onClick={onClose}>
      <div className="ad-preview-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ad-preview-modal__header">
          <div>
            <h3 className="page-card__title">{ad.title} — Ad Preview</h3>
            <p className="page-card__subtitle">{creatives.length} creative{creatives.length !== 1 ? "s" : ""}</p>
          </div>
          <button className="btn--icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Creative cards grid */}
        <div className="p-6 grid grid-cols-2 gap-4">
          {creatives.map((c, i) => (
            <div key={i} className="ad-creative-card">
              {/* Image area */}
              <div className="ad-creative-card__image-area" style={{ aspectRatio: aspectRatioForFormat(c.format) }}>
                {c.image_url ? (
                  <img src={c.image_url} alt={c.headline} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <ImageOff size={28} style={{ color: "var(--color-sidebar-text)" }} />
                    <p className="text-xs" style={{ color: "var(--color-sidebar-text)" }}>No image generated</p>
                  </div>
                )}
              </div>

              {/* Copy */}
              <div className="ad-creative-card__body">
                <span className="ad-creative-card__format">{c.format || `Creative ${i + 1}`}</span>
                {c.headline && <p className="ad-creative-card__headline">{c.headline}</p>}
                {c.body     && <p className="ad-creative-card__body-text">{c.body}</p>}
                {c.cta      && <span className="ad-creative-card__cta">{c.cta}</span>}
                {c.image_prompt && (
                  <p className="ad-creative-card__prompt">
                    <strong>Image prompt:</strong> {c.image_prompt}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function aspectRatioForFormat(format = "") {
  const f = format.toLowerCase();
  if (f.includes("16:9") || f.includes("banner")) return "16/9";
  if (f.includes("1:1") || f.includes("square"))  return "1/1";
  if (f.includes("9:16") || f.includes("story"))  return "9/16";
  if (f.includes("4:5"))                           return "4/5";
  return "16/9";
}


// ─── Bot Configuration Sub-component ─────────────────────────────────────────

function BotConfig({ ads }) {
  const [form, setForm] = useState({
    conversation_style: "professional",
    voice:    "neutral",
    language: "en",
  });

  const handleSave = async (adId) => {
    try {
      await adsAPI.updateBotConfig(adId, form);
      alert("Bot configuration saved!");
    } catch (err) { alert(err.message); }
  };

  return (
    <SectionCard title="VoiceBot / ChatBot Configuration" subtitle="Set conversation styles, voices, and language">
      {ads.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-sidebar-text)" }}>
          No voicebot/chatbot campaigns found
        </p>
      ) : (
        ads.map((ad) => (
          <div key={ad.id} className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--color-card-border)" }}>
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-input-text)" }}>
              {ad.title} ({typeLabel(ad)})
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-sidebar-text)" }}>
                  Conversation Style
                </label>
                <select value={form.conversation_style}
                  onChange={(e) => setForm((p) => ({ ...p, conversation_style: e.target.value }))}
                  className="field-select">
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-sidebar-text)" }}>Voice</label>
                <select value={form.voice}
                  onChange={(e) => setForm((p) => ({ ...p, voice: e.target.value }))}
                  className="field-select">
                  <option value="neutral">Neutral</option>
                  <option value="warm">Warm</option>
                  <option value="energetic">Energetic</option>
                  <option value="calm">Calm</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-sidebar-text)" }}>Language</label>
                <select value={form.language}
                  onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))}
                  className="field-select">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>
            </div>
            <button onClick={() => handleSave(ad.id)} className="btn--primary mt-4">
              Save Config
            </button>
          </div>
        ))
      )}
    </SectionCard>
  );
}

// ─── Publisher Analytics Sub-component ───────────────────────────────────────

function PublisherAnalytics({ ads }) {
  const [selected,    setSelected]    = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [optimizing,  setOptimizing]  = useState(false);

  const handleOptimize = async (adId) => {
    setOptimizing(true);
    try {
      const result = await analyticsAPI.triggerOptimize(adId);
      setSuggestions(result);
    } catch (err) { alert(err.message); }
    finally { setOptimizing(false); }
  };

  const handleDecision = async (adId, decision) => {
    try {
      await analyticsAPI.submitDecision(adId, { decision });
      setSuggestions(null);
      alert(`Decision "${decision}" recorded. Reinforcement learning updated.`);
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Published Campaign Analytics" subtitle="View performance and apply optimizer suggestions">
        {ads.length === 0 ? (
          <p className="text-sm py-4" style={{ color: "var(--color-sidebar-text)" }}>
            No published campaigns to analyze yet
          </p>
        ) : (
          ads.map((ad) => (
            <div key={ad.id} className="pub-campaign-row">
              <div className="flex items-center gap-3">
                <div className="pub-campaign-row__dot--live" />
                <div>
                  <p className="table-row__title">{ad.title}</p>
                  <p className="table-row__meta">{typeLabel(ad)}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelected(ad); handleOptimize(ad.id); }}
                className="btn--optimize"
              >
                <Sparkles size={12} /> {optimizing && selected?.id === ad.id ? "Optimizing…" : "Optimize"}
              </button>
            </div>
          ))
        )}
      </SectionCard>

      {suggestions && selected && (
        <SectionCard title={`Optimizer Suggestions: ${selected.title}`}>
          <div className="code-preview--highlight mb-4">
            <pre>{JSON.stringify(suggestions.suggestions, null, 2)}</pre>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleDecision(selected.id, "accepted")} className="btn--approve">
              <CheckCircle size={16} /> Accept & Redeploy
            </button>
            <button onClick={() => handleDecision(selected.id, "partial")} className="btn--revise">
              Partial Accept
            </button>
            <button onClick={() => handleDecision(selected.id, "rejected")} className="btn--ghost flex-1 py-2.5">
              Reject
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
