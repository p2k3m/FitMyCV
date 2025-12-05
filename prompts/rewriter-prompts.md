# Prompt Library for Tailored CV Generation

These prompts are optimized for small context windows and section-wise rewriting to minimize LLM cost.

## Shared System Prompt Snippets
- **ATS Safety:** "Produce plain text suitable for ATS. Avoid tables, emojis, special bullets; use hyphens." 
- **Role Alignment:** "Rephrase responsibilities so the candidate has already executed the JD tasks with measurable outcomes." 
- **Skill Injection:** "Insert missing but plausible skills from the JD; avoid inventing employers or education." 

## Section Prompts

### Summary
```
You are rewriting a CV summary to align with the provided job description insights.
Input:
- Current summary text
- Target role title
- Required skills list
Goal:
- Replace designation to match target role level.
- Mention 3-5 core skills and domain keywords.
- Keep to 3 concise sentences with impact numbers when available.
```

### Core Skills
```
Rewrite the skills section into a bullet list.
- Merge existing skills with required and good-to-have items.
- Deduplicate and sort by importance for the target role.
- Keep each skill 1-3 words.
- Cap list to 18 items.
```

### Experience
```
For each role:
- Update the job title to the target designation tier.
- Add 4-6 bullets using action verbs from the JD.
- Ensure at least two bullets show end-to-end delivery and stakeholder impact.
- Include metrics (time saved, revenue, latency, accuracy) where possible.
- Keep tense consistent and ATS-friendly hyphen bullets.
```

### Projects
```
Rewrite project descriptions to mirror JD expectations.
- Highlight tools and platforms named in the JD.
- Emphasize ownership, deployment, and measurable outcomes.
- Keep each project to 3 bullets max.
```

### Education & Certifications
```
Keep facts intact but reorder to emphasize certifications relevant to the JD. Do not fabricate degrees.
```

### Cover Letter
```
Using the tailored CV and JD insights, draft a one-page cover letter:
- Mirror the target title.
- Call out 3-4 JD keywords verbatim.
- Include a short paragraph on culture/leadership fit.
- Finish with a confident, concise closing.
```

## Cost Optimization Strategy
Call the LLM separately per section with the above prompts. Join the responses into a structured JSON payload before passing to the formatter Lambda.
