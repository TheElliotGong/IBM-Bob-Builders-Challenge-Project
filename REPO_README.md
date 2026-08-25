# AI Launch Vehicle / Rideshare Selector
### IBM Builders Challenge — August 2026: Mission Beyond Earth (Space Exploration)

An AI-powered mission-planning configurator that takes a small satellite mission's requirements — payload mass, target orbit, budget, timeline — and recommends the best-fit launch provider from a curated catalog of real options, with a plain-language explanation of trade-offs.

---

## What it does

1. **Parses** a free-text mission description into structured fields (payload mass, orbit type/altitude, budget ceiling, schedule urgency) via an LLM prompt.
2. **Filters** the provider catalog to eliminate options that physically can't meet the mass or orbit constraints.
3. **Ranks** remaining options by user-weighted priorities (cost vs. schedule control vs. orbit precision).
4. **Explains** the recommendation in plain language — why the top pick wins and what the trade-offs are against alternatives.

---

## Repository structure

```
data/
  catalog.schema.json   — JSON Schema (draft-07) defining every field in a catalog entry
  catalog.json          — Starter catalog of 7 launch vehicles / rideshare programs
src/
  (parser, filter, ranker, explainer — built in Days 2–4)
public/
  (UI assets — built in Day 6)
```

---

## Catalog (Day 1)

Seven entries covering the realistic trade-space for smallsat / cubesat missions:

| ID | Provider | Vehicle | Type | Max Payload | Est. Cost |
|---|---|---|---|---|---|
| `spacex-transporter` | SpaceX | Falcon 9 Transporter | rideshare | 200 kg SSO | ~$6,000/kg |
| `rocketlab-electron` | Rocket Lab | Electron | dedicated-small | 300 kg LEO | ~$8M/launch |
| `firefly-alpha` | Firefly Aerospace | Alpha | dedicated-small | 1,030 kg LEO | ~$15M/launch |
| `arianespace-vega-c-ssms` | Arianespace / ESA | Vega-C SSMS | rideshare | 700 kg SSO | ~$20,000/kg |
| `isro-pslv-cl` | ISRO / NSIL | PSLV-C (commercial) | rideshare | 1,750 kg SSO | ~$15,000/kg |
| `virgin-orbit-launcher-one` | Virgin Orbit | LauncherOne | dedicated-small | 500 kg LEO | *retired* |
| `exolaunch-rideshare-d-orbit` | D-Orbit / Exolaunch | ION Satellite Carrier | rideshare | 450 kg SSO | ~$10,000/kg |

> **Data accuracy note:** figures are sourced from publicly available payload user's guides, commercial rate cards, and investor materials current as of mid-2025. Verify final numbers from each provider's official Payload User's Guide before any real mission commitment. The Virgin Orbit entry is retained as a retired historical reference only.

---

## Build Plan

| Day | Focus | Status |
|---|---|---|
| 1 | Scope lock; JSON schema; starter catalog (7 entries) | ✅ Complete |
| 2–3 | LLM input parser + catalog filter + matcher | ✅ Complete |
| 4 | Weighted ranker + LLM explanation layer | ⬜ |
| 5 | Test against 5–6 varied example missions; tune | ⬜ |
| 6 | Polish UI; write submission narrative | ⬜ |
| 7 | Buffer + submit | ⬜ |

---

## Category framing

Submitted under the **"AI-powered mission planning assistant"** category. The configurator targets the early mission-design / architecture phase — it helps a payload owner quickly understand which launch options exist, what the trade-offs are, and which is the best fit for their constraints — before committing to a provider or procurement process.
