"""
M7: Optimizer Service (Optimization Automation)
Owner: AI Dev
Dependencies: M1, M6

Weighted suggestion engine that analyzes performance data and produces
human-in-the-loop optimization suggestions.

Factors:
- Websites: user retention, click rate, follow-through rate, call duration
- Ads: click rate, views, demographics, likes

Context from Reviewer adds situational awareness.
"""

import json
import httpx
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Advertisement, AdAnalytics, Review, SkillConfig
from app.core.config import settings


# Weight configuration per ad type
WEBSITE_WEIGHTS = {
    "user_retention": 0.30,
    "click_rate": 0.25,
    "follow_through": 0.25,
    "call_duration": 0.20,
}

AD_WEIGHTS = {
    "click_rate": 0.30,
    "views": 0.20,
    "demographics_match": 0.25,
    "likes": 0.10,
    "conversions": 0.15,
}


class OptimizerService:
    def __init__(self, db: AsyncSession, company_id: str):
        self.db = db
        self.company_id = company_id

    async def generate_suggestions(
        self,
        advertisement: Advertisement,
        analytics: List[AdAnalytics],
        reviews: List[Review],
    ) -> Dict[str, Any]:
        """
        Produce weighted optimization suggestions.

        1. Compute weighted performance score
        2. Identify underperforming factors
        3. Gather reviewer context for situational awareness
        4. Call Claude to produce actionable suggestions
        5. Return suggestions for human review
        """
        # Step 1-2: Compute scores and find weak spots
        perf_analysis = self._analyze_performance(advertisement, analytics)

        # Step 3: Gather reviewer context
        reviewer_context = self._extract_reviewer_context(reviews)

        # Step 4: Generate AI suggestions
        suggestions = await self._generate_ai_suggestions(
            advertisement, perf_analysis, reviewer_context
        )

        return {
            "suggestions": suggestions,
            "context": {
                "performance_analysis": perf_analysis,
                "reviewer_context": reviewer_context,
            },
        }

    def _analyze_performance(
        self, ad: Advertisement, analytics: List[AdAnalytics]
    ) -> Dict[str, Any]:
        """Compute weighted performance scores and identify weak factors."""
        if not analytics:
            return {"status": "no_data", "message": "No analytics data available yet"}

        is_website = "website" in ad.ad_type
        weights = WEBSITE_WEIGHTS if is_website else AD_WEIGHTS

        # Average the metrics across all data points
        metrics = {}
        for key in weights:
            values = []
            for a in analytics:
                val = getattr(a, key, None)
                if val is not None:
                    values.append(val)
            metrics[key] = sum(values) / len(values) if values else 0.0

        # Compute weighted score (normalize to 0-100)
        weighted_score = sum(
            metrics.get(k, 0) * w for k, w in weights.items()
        )

        # Find underperformers (below threshold)
        weak_factors = []
        for key, weight in weights.items():
            val = metrics.get(key, 0)
            # Simple heuristic: flag if contribution is less than half its potential
            if val * weight < weight * 50:  # assuming 100-scale
                weak_factors.append({
                    "factor": key,
                    "current_value": val,
                    "weight": weight,
                    "impact": "high" if weight >= 0.25 else "medium",
                })

        return {
            "status": "analyzed",
            "ad_type": ad.ad_type,
            "weighted_score": round(weighted_score, 2),
            "metrics": metrics,
            "weights_used": weights,
            "weak_factors": weak_factors,
            "data_points": len(analytics),
        }

    def _extract_reviewer_context(self, reviews: List[Review]) -> Dict[str, Any]:
        """
        Extract context from reviewer feedback for situational awareness.
        This informs the optimizer about business constraints and priorities.
        """
        context = {
            "total_reviews": len(reviews),
            "approved_count": sum(1 for r in reviews if r.status == "approved"),
            "revision_requests": [],
            "ethical_concerns": [],
            "human_suggestions": [],
        }

        for review in reviews:
            if review.status == "revision":
                context["revision_requests"].append(review.comments)
            if review.review_type == "ethics":
                context["ethical_concerns"].append(review.comments)
            if review.suggestions:
                context["human_suggestions"].append(review.suggestions)

        return context

    async def _generate_ai_suggestions(
        self,
        ad: Advertisement,
        perf_analysis: Dict,
        reviewer_context: Dict,
    ) -> Dict[str, Any]:
        """Use Claude to generate actionable optimization suggestions."""
        system_prompt = """You are a marketing optimization AI. 
Analyze performance data and reviewer context to produce specific, actionable suggestions.
Each suggestion should include: what to change, expected impact, and priority level.
Respond ONLY with a JSON object."""

        user_message = f"""## Advertisement: {ad.title} ({", ".join(ad.ad_type)})

## Performance Analysis
{json.dumps(perf_analysis, indent=2)}

## Reviewer Context (Situational Awareness)
{json.dumps(reviewer_context, indent=2)}

## Current Strategy
{json.dumps(ad.strategy_json, indent=2) if ad.strategy_json else "N/A"}

Produce optimization suggestions as JSON:
{{
    "overall_assessment": "...",
    "priority_actions": [
        {{
            "action": "...",
            "target_factor": "...",
            "expected_impact": "...",
            "priority": "high|medium|low",
            "implementation": "..."
        }}
    ],
    "content_changes": [...],
    "budget_reallocation": {{...}},
    "a_b_test_proposals": [...]
}}
"""

        if not settings.ANTHROPIC_API_KEY:
            return self._mock_suggestions(perf_analysis)

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 2048,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_message}],
                },
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()

        text = "".join(b["text"] for b in data.get("content", []) if b.get("type") == "text")
        try:
            clean = text.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            return {"raw_response": text}

    def _mock_suggestions(self, perf: Dict) -> Dict[str, Any]:
        weak = perf.get("weak_factors", [])
        actions = []
        for wf in weak[:3]:
            actions.append({
                "action": f"Improve {wf['factor'].replace('_', ' ')}",
                "target_factor": wf["factor"],
                "expected_impact": f"+{int(wf['weight']*100)}% improvement potential",
                "priority": wf["impact"],
                "implementation": f"A/B test variations targeting {wf['factor']}",
            })

        return {
            "overall_assessment": f"Score: {perf.get('weighted_score', 'N/A')}. {len(weak)} factors need attention.",
            "priority_actions": actions or [{"action": "Continue monitoring", "priority": "low"}],
            "content_changes": ["Refresh hero copy", "Update CTA button color"],
            "budget_reallocation": {"shift_from": "display", "shift_to": "search", "amount": "10%"},
            "a_b_test_proposals": ["Test headline variants", "Test landing page layout"],
        }
