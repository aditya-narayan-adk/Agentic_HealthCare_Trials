"""
M5: Curator Service (Marketing Skill Template Agent)
Owner: AI Dev
Dependencies: M1, M4 (Training)

Takes input documents + company context, generates marketing strategy.
Uses the company-customized Curator SKILL.md as its system prompt.
Calls Claude API to produce strategy JSON.
"""

import json
import httpx
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Advertisement, CompanyDocument, SkillConfig, DocumentType
from app.core.config import settings


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
        """Load the company-specific SKILL.md from DB."""
        result = await self.db.execute(
            select(SkillConfig).where(
                SkillConfig.company_id == self.company_id,
                SkillConfig.skill_type == skill_type,
            )
        )
        skill = result.scalar_one_or_none()
        if not skill:
            raise ValueError(
                f"Skill '{skill_type}' not found for company {self.company_id}. "
                "Run training first via /onboarding/train"
            )
        return skill.skill_md

    def _build_context(
        self,
        ad: Advertisement,
        docs: List[CompanyDocument],
    ) -> str:
        """
        Build the user message with all relevant context.
        Reference documents (from reinforcement learning) get higher priority.
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

        # HIGH PRIORITY: Reference documents (lessons learned)
        ref_docs = [d for d in docs if d.doc_type == DocumentType.REFERENCE]
        if ref_docs:
            sections.append("## Reference Documents (HIGH PRIORITY — Lessons Learned)")
            for doc in ref_docs:
                sections.append(f"### {doc.title}\n{doc.content or '[See file]'}")

        # Input documents
        input_docs = [d for d in docs if d.doc_type == DocumentType.INPUT]
        if input_docs:
            sections.append("## Input Documents")
            for doc in input_docs:
                sections.append(f"### {doc.title}\n{doc.content or '[See file]'}")

        # Company context docs
        other_docs = [d for d in docs if d.doc_type not in (DocumentType.REFERENCE, DocumentType.INPUT)]
        if other_docs:
            sections.append("## Company Context Documents")
            for doc in other_docs:
                sections.append(f"### [{doc.doc_type.value}] {doc.title}\n{doc.content or '[See file]'}")

        sections.append("""
## Instructions
Based on all the above context, generate a comprehensive marketing strategy 
as a JSON object following the format defined in your skill instructions.
Respond ONLY with the JSON object, no additional text.
""")

        return "\n\n".join(sections)

    async def _call_claude(self, system_prompt: str, user_message: str) -> Dict[str, Any]:
        """Call the Anthropic API with the skill as system prompt."""
        if not settings.ANTHROPIC_API_KEY:
            # Return mock strategy for development
            return self._mock_strategy()

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

        # Extract text content
        text = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                text += block["text"]

        # Parse JSON from response
        try:
            # Strip potential markdown fences
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
