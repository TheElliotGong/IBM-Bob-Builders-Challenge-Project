# Satellite Launch Vehicle / Rideshare Configurator
### IBM Builders Challenge with IBM Bob — August 2026: Mission Beyond Earth (Space Exploration)

---

## Concept

An AI-powered configurator that takes a small satellite mission's requirements (payload mass, target orbit, budget, timeline) and recommends the best-fit launch provider from a catalog of real options — with a plain-language explanation of the trade-offs.

This is a direct adaptation of a product configurator pattern (as used to tailor recommendations and orders for customers): swap "customer requirements → product catalog → recommendation + order" for "mission requirements → launch provider catalog → recommendation + mission brief."

**Category fit:** This sits in the early mission-design/architecture phase rather than day-to-day operations planning, so it's best framed explicitly in the submission as a mission-planning assistant for the design phase — e.g. "AI mission architecture configurator" — to make the connection to the "AI-powered mission planning assistant" category clear to judges rather than leaving it implicit.

---

## Architecture

1. **Input parser** — LLM converts a free-text mission description (e.g. "60 kg cubesat, need SSO around 500km, launching within 6 months, budget under $500k") into structured fields: payload mass, target orbit type/altitude, budget ceiling, schedule urgency.
2. **Catalog filter** — matches structured requirements against the provider catalog, eliminating options that can't physically meet mass/orbit constraints.
3. **Ranker** — scores remaining options against user-weighted priorities (cost vs. schedule control vs. orbit precision). Letting the user adjust weights mirrors how a buyer prioritizes price vs. features in a product configurator.
4. **Explainer** — LLM generates a plain-language rationale for the recommendation (e.g. "Electron costs more per kg but gives you a custom inclination and a shorter integration timeline than Transporter's fixed SSO slot").

---

## Starter Catalog

Seed data points to verify against each provider's official payload user's guide before submission (see note below):

| Provider | Type | Payload Capacity | Est. Cost | Orbit Fit |
|---|---|---|---|---|
| SpaceX Transporter | Rideshare | Base slot up to 50 kg, additional mass priced per kg | $350,000 for 50 kg + $7,000/kg beyond, to SSO | Sun-synchronous orbit, fixed schedule set by primary mission |
| Rocket Lab Electron | Dedicated small launch | Up to 300 kg to LEO | ~$7.5M per launch (~$25,000/kg) | Custom inclination/orbit, own schedule |
| Firefly Alpha | Dedicated, mid-size smallsat | 1,030 kg to 200 km LEO / 630 kg to 500 km SSO | ~$15–17.6M per launch | Custom orbit, larger payload capacity |

**Note on data accuracy:** the figures above come from market-analysis sources current as of mid-2026, not each provider's official rate card. Before locking in the catalog, pull final numbers from primary sources: SpaceX's Rideshare Payload User's Guide, Rocket Lab's Electron payload guide, and Firefly's Alpha payload user's guide. Add 2–3 more providers (e.g. Arianespace Vega C SSMS, ISRO PSLV/SSLV) if time allows, to strengthen the trade-space demo.

---

## Build Plan (1 Week)

| Day | Focus |
|---|---|
| 1 | Lock scope; define the JSON schema per provider (capacity, cost, orbit options, integration lead time, cadence); build the starter catalog (5–8 entries) from primary sources |
| 2–3 | Build the parser + filter + matcher in IBM Bob — the core of the AI work |
| 4 | Add the ranker (weighted priorities) and the LLM explanation layer |
| 5 | Test against 5–6 varied example missions (tiny cubesat/tight budget, larger payload/flexible budget, etc.); tune explanations |
| 6 | Polish UI; write the submission narrative, explicitly framing the tool as a mission-planning/architecture assistant |
| 7 | Buffer + submit |

---

## Next Steps
- Draft the JSON catalog schema
- Draft the constraint-parsing prompt for the LLM
- Confirm exact submission requirements on the official challenge page (deliverable format, required use of IBM Bob/watsonx, demo video, etc.)
