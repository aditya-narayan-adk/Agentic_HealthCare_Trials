"""
M5: Curator Service (Marketing Skill Template Agent)
Owner: AI Dev
Dependencies: M1, M4 (Training)

Takes input documents + company context, generates marketing strategy.
Uses the company-customized Curator SKILL.md as its system prompt.
Calls Claude API to produce strategy JSON.
"""

import json
import os
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Advertisement, CompanyDocument, SkillConfig, DocumentType
from app.core.bedrock import get_async_client, get_model, is_configured

_SKILLS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "skills", "templates")
)


class CuratorService:
    def __init__(self, db: AsyncSession, company_id: str):
        self.db = db
        self.company_id = company_id

    async def generate_strategy(
        self,
        advertisement: Advertisement,
        company_docs: List[CompanyDocument],
    ) -> Dict[str, Any]:
        """
        Generate a marketing strategy using the Curator skill.
        
        Flow:
        1. Load the company's customized Curator SKILL.md
        2. Build context from input documents + reference documents
        3. Call Claude API with the skill as system prompt
        4. Parse and return strategy JSON
        """
        # Step 1: Load customized skill
        skill_md = await self._load_skill("curator")

        # Step 2: Build document context
        context = self._build_context(advertisement, company_docs)

        # Step 3: Call Claude API
        strategy = await self._call_claude(skill_md, context)

        return strategy

    async def _load_skill(self, skill_type: str) -> str:
        """
        Load the company-specific SKILL.md from DB.
        Falls back to the generic template if training hasn't been run yet.
        """
        result = await self.db.execute(
            select(SkillConfig).where(
                SkillConfig.company_id == self.company_id,
                SkillConfig.skill_type == skill_type,
            ).order_by(SkillConfig.version.desc())
        )
        skill = result.scalars().first()
        if skill:
            return skill.skill_md

        # Fall back to the generic template so generation still works
        # before training is run. Log a warning so it's visible in server logs.
        template_path = os.path.join(_SKILLS_DIR, f"{skill_type}_template.md")
        if os.path.exists(template_path):
            import logging
            logging.getLogger(__name__).warning(
                "No trained '%s' skill for company %s — using generic template. "
                "Run POST /api/onboarding/train to customise.",
                skill_type, self.company_id,
            )
            with open(template_path, "r") as f:
                return f.read()

        raise ValueError(
            f"Skill '{skill_type}' not found and template is missing. "
            "Run POST /api/onboarding/train first."
        )

    def _build_context(
        self,
        ad: Advertisement,
        docs: list,
    ) -> str:
        """
        Build the user message with all relevant context.

        Doc priority convention:
          priority > 0  → campaign-specific protocol docs (AdvertisementDocument)
          priority == 0 → company-level docs (CompanyDocument)
            - doc_type == REFERENCE → lessons learned (highest importance)
            - doc_type == INPUT     → input briefs
            - everything else       → company context
        """
        sections = []

        # Advertisement parameters
        sections.append(f"""## Advertisement Brief
- Title: {ad.title}
- Type: {", ".join(ad.ad_type)}
- Budget: {ad.budget or 'Not specified'}
- Platforms: {json.dumps(ad.platforms) if ad.platforms else 'Not specified'}
- Target Audience: {json.dumps(ad.target_audience) if ad.target_audience else 'Not specified'}
""")

        # Campaign-specific protocol documents (priority > 0)
        protocol_docs = [d for d in docs if d.priority > 0]
        if protocol_docs:
            sections.append("## Campaign Protocol Documents (HIGH PRIORITY — Campaign-Specific Context)")
            for doc in protocol_docs:
                doc_type_label = doc.doc_type if isinstance(doc.doc_type, str) else doc.doc_type.value
                content = getattr(doc, 'content', None) or '[See attached file]'
                sections.append(f"### [{doc_type_label}] {doc.title}\n{content}")

        # Company-level: Reference / lessons learned
        ref_docs = [d for d in docs if d.priority == 0 and d.doc_type == DocumentType.REFERENCE]
        if ref_docs:
            sections.append("## Reference Documents (HIGH PRIORITY — Lessons Learned)")
            for doc in ref_docs:
                sections.append(f"### {doc.title}\n{doc.content or '[See file]'}")

        # Company-level: Input briefs
        input_docs = [d for d in docs if d.priority == 0 and d.doc_type == DocumentType.INPUT]
        if input_docs:
            sections.append("## Input Documents")
            for doc in input_docs:
                sections.append(f"### {doc.title}\n{doc.content or '[See file]'}")

        # Company-level: Everything else (USP, compliance, policy, etc.)
        other_docs = [
            d for d in docs
            if d.priority == 0 and d.doc_type not in (DocumentType.REFERENCE, DocumentType.INPUT)
        ]
        if other_docs:
            sections.append("## Company Context Documents")
            for doc in other_docs:
                doc_type_label = doc.doc_type if isinstance(doc.doc_type, str) else doc.doc_type.value
                sections.append(f"### [{doc_type_label}] {doc.title}\n{doc.content or '[See file]'}")

        sections.append("""
## Instructions
Based on all the above context, generate a comprehensive marketing strategy 
as a JSON object following the format defined in your skill instructions.
Respond ONLY with the JSON object, no additional text.
""")

        return "\n\n".join(sections)

    async def _call_claude(self, system_prompt: str, user_message: str) -> Dict[str, Any]:
        """Call Claude (direct API or Bedrock) with the skill as system prompt."""
        if not is_configured():
            return self._mock_strategy()

        client   = get_async_client()
        response = await client.messages.create(
            model=get_model(),
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        text = response.content[0].text

        try:
            clean = text.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            return {"raw_response": text, "parse_error": True}

    def _mock_strategy(self) -> Dict[str, Any]:
        """Development mock — returned when no API key is configured."""
        return {
            "executive_summary": "Mock strategy for development testing",
            "target_audience": {
                "primary": "Professionals aged 25-45",
                "demographics": {"age": "25-45", "income": "mid-to-high"},
            },
            "messaging": {
                "core_message": "Elevate your experience",
                "tone": "Professional yet approachable",
                "key_phrases": ["innovation", "reliability", "growth"],
                "cta": "Get Started Today",
            },
            "channels": [
                {"platform": "Google Ads", "strategy": "Search + Display", "budget_allocation": 0.4},
                {"platform": "Instagram", "strategy": "Stories + Reels", "budget_allocation": 0.3},
                {"platform": "LinkedIn", "strategy": "Sponsored Content", "budget_allocation": 0.3},
            ],
            "content_plan": {
                "website": {"pages": ["Home", "About", "Services", "Contact"], "design_direction": "Modern minimal"},
                "ads": {"formats": ["Banner", "Video", "Carousel"], "copy_variants": 3},
            },
            "kpis": ["CTR > 2%", "Conversion rate > 5%", "CPA < $50"],
            "budget_breakdown": {"creative": 0.3, "media_buy": 0.5, "tools": 0.1, "contingency": 0.1},
        }