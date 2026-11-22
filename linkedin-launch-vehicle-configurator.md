# LinkedIn content — Satellite Launch Vehicle / Rideshare Configurator

## 1. Projects section entry

**Project name:**
Satellite Launch Vehicle / Rideshare Configurator — IBM AI Builders Challenge

**Date:** August 2026

**Description:**
Built an AI-powered mission-planning tool for the IBM AI Builders Challenge (Space Exploration track), built with IBM Bob in under a week. Small satellite teams normally lose days cross-referencing dozens of launch-provider guides and rate cards to answer one question: which rocket can carry their payload to the right orbit, on budget, in time. This tool collapses that into seconds — a user describes their mission in plain English, and the app parses it into structured requirements (payload mass, orbit, budget, schedule, inclination), filters a curated catalog of 7 real launch vehicles and rideshare programs, ranks the survivors against the user's weighted priorities, and explains the trade-offs in plain language.

Used Gemini Flash for natural-language parsing, trade-off explanation, and description improvement, with full offline fallbacks (regex parser, template explainer) so the app works without an API key. Shipped with a 193-test Jest suite, document upload (PDF/DOCX/TXT/MD) with server-side extraction, six export formats, session history, and a full settings system.

**Skills:** Next.js · TypeScript · React · Gemini API / LLM Integration · AI Product Design · Jest · API Design · Prompt Engineering

**Links:**
- GitHub: https://github.com/TheElliotGong
- Website: https://theelliotgong.com

---

## 2. LinkedIn feed post

Spent this past week building something for the IBM AI Builders Challenge (Space Exploration track), paired with IBM Bob the whole way through.

The problem: small satellite and CubeSat teams usually start mission planning by manually cross-referencing dozens of launch-provider guides, rate cards, and schedule announcements just to answer one question — which rocket can actually carry my satellite to the right orbit, on budget, in time?

So I built a Satellite Launch Vehicle / Rideshare Configurator. Describe your mission in plain English, and it:

→ Parses your description into structured requirements (payload mass, orbit, budget, schedule, inclination) using Gemini Flash
→ Filters a curated catalog of 7 real launch vehicles and rideshare programs against your hard constraints
→ Ranks what's left by your weighted priorities — cost, schedule, orbit precision
→ Explains the trade-offs in plain language, so you understand *why* the top pick wins

What made this fun to build fast: IBM Bob handled architecture and scoping, generated the core pipeline (parser, filter, ranker, explainer) and API routes, wrote a 193-test Jest suite, and iterated on UI components with me — freeing me up to focus on product decisions like the "Improve my description" flow and the fallback design (the app works fully even without a Gemini API key).

A week, one AI coding partner, and a working end-to-end mission-planning tool. Excited to keep pushing on this one.

#IBMAIBuildersChallenge #AI #SpaceExploration #IBMBob #BuildInPublic #GameDev #SoftwareEngineering

---

*Tip: LinkedIn posts perform best with a visual — consider adding a screenshot or short screen recording of the app's ranked results screen when you post.*
