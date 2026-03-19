"""
M6: Reviewer Service (Reviewer Skill Template Agent)
Owner: AI Dev
Dependencies: M1, M4 (Training)

Reviews Curator-generated strategies and produces:
- Website Requirements (for the Website Development Agent)
- Advertisement Details (for the Advertisement Agent)
- Compliance checks and ethical flags
"""

import json
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Advertisement, SkillConfig, Review
from app.core.config import settings


class ReviewerService:
    def __init__(self, db: AsyncSession, company_id: str):
        self.db = db
        self.company_id = company_id

    async def pre_review(self, advertisement: Advertisement) -> Dict[str, Any]:
        """
        AI pre-review of the Curator's strategy.
        Produces structured outputs for downstream agents.
        
        Returns:
            {
                "review_verdict": "approved" | "needs_revision",
                "website_requirements": {...},
                "ad_details": {...},
                "ethical_flags": [...],
                "compliance_check": {...}
            }
        """
        # Load reviewer skill
        skill_md = await self._load_skill("reviewer")

        # Build review prompt
        prompt = self._build_review_prompt(advertisement)

        # Call Claude API
        review_output = await self._call_claude(skill_md, prompt)

        return review_output

    async def incorporate_human_feedback(
        self,
        advertisement: Advertisement,
        reviews: List[Review],
    ) -> Dict[str, Any]:
        """
        Re-process strategy incorporating human reviewer feedback.
        Called when a human reviewer sends suggestions back to the AI.
        """
        skill_md = await self._load_skill("reviewer")
        
        feedback_context = "\n\n".join([
            f"### Review by {r.review_type} reviewer\n"
            f"Status: {r.status}\n"
            f"Comments: {r.comments or 'None'}\n"
            f"Suggestions: {json.dumps(r.suggestions) if r.suggestions else 'None'}\n"
            f"Edited Strategy: {json.dumps(r.edited_strategy) if r.edited_strategy else 'None'}"
            for r in reviews
        ])

        prompt = f"""{self._build_review_prompt(advertisement)}

## Human Reviewer Feedback (HIGH PRIORITY)
{feedback_context}

Incorporate all human feedback and produce an updated review output.
"""
        return await self._call_claude(skill_md, prompt)

    def _build_review_prompt(self, ad: Advertisement) -> str:
        strategy = json.dumps(ad.strategy_json, indent=2) if ad.strategy_json else "No strategy generated yet"
        return f"""## Strategy to Review

**Advertisement:** {ad.title}
**Type:** {", ".join(ad.ad_type)}
**Budget:** {ad.budget or 'Not specified'}

### Strategy JSON
```json
{strategy}
```

Review this strategy and produce the complete review output as JSON,
including website_requirements and ad_details sections.
Respond ONLY with the JSON object.
"""

    async def _load_skill(self, skill_type: str) -> str:
        result = await self.db.execute(
            select(SkillConfig).where(
                SkillConfig.company_id == self.company_id,
                SkillConfig.skill_type == skill_type,
            )
        )
        skill = result.scalar_one_or_none()
        if not skill:
            raise ValueError(f"Skill '{skill_type}' not initialized. Run training first.")
        return skill.skill_md

    async def _call_claude(self, system_prompt: str, user_message: str) -> Dict[str, Any]:
        if not settings.ANTHROPIC_API_KEY:
            return self._mock_review()

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
                    "max_tokens": 4096,
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
            return {"raw_response": text, "parse_error": True}

    def _mock_review(self) -> Dict[str, Any]:
        return {
            "review_verdict": "approved",
            "quality_score": 8.5,
            "compliance_check": {"passed": True, "issues": []},
            "ethical_flags": [],
            "website_requirements": {
                "pages": ["Home", "About", "Services", "Contact", "Blog"],
                "design_system": {"colors": ["#1a1a2e", "#16213e", "#e94560"], "font": "Inter"},
                "content_blocks": ["Hero", "Features", "Testimonials", "CTA", "Footer"],
                "seo_requirements": {"meta_tags": True, "structured_data": True},
            },
            "ad_details": {
                "formats": ["1080x1080 Static", "1080x1920 Story", "16:9 Video"],
                "copy_variants": [
                    {"headline": "Transform Your Business", "body": "Start your journey today"},
                    {"headline": "Results That Speak", "body": "Join thousands of satisfied clients"},
                ],
                "visual_specs": {"style": "Modern minimal", "imagery": "Professional photography"},
                "platform_configs": {
                    "instagram": {"placements": ["feed", "stories", "reels"]},
                    "google": {"campaign_type": "search+display"},
                },
            },
        }
