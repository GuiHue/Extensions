# PIA for clipx ENGINEER – open items

## 1. clipx ENGINEER documentation tool (blocking, to be fixed in the MCP server)

PIA has no tool that returns clipx ENGINEER software documentation (operation, menus, licensing, installation, errors).
Until it exists, the system prompt forbids answering these questions from memory and refers users to their local
Phoenix Contact representative.

When the tool is available, update `system-prompt.md`:

- Tools table: add the new tool.
- Mission: replace the "Questions about operating clipx ENGINEER itself" paragraph with a workflow that uses the tool.
- Referral table: remove the "clipx ENGINEER operation" row.
- Error Handling: remove the "Question about operating clipx ENGINEER" row.
- Hard Prohibition 4: allow describing procedures that are in tool results.
- Add query-formulation and citation rules for the software documentation.

## 2. Tool definition fixes

- `respond_to_user.status` description says "escalated: referral to Phoenix Contact Support". This bot has no
  support handover; the prompt uses `escalated` for referrals to the local Phoenix Contact representative.
  Align the description.
- `retrieve_property_value_match.language` says to detect the language from the query text. The prompt instead
  runs one call per language seen in the search results and writes the query term in that language. Both agree
  only if the query term is translated per call; consider rewording the description to match.
- `productDetection` has no documented output format (score/confidence?). The prompt's acceptance rules are based
  on name similarity only. If the tool returns a confidence, add thresholds to the "How to use the result" section.

## 3. Capabilities removed (users will ask)

Availability/stock and delivery checks are not offered in clipx ENGINEER (product decision); the prompt contains
no availability logic. If users ask anyway, PIA refers them to the local Phoenix Contact representative.

No tools for CAD data, images, software downloads, compliance documents. These are referred to the local Phoenix Contact representative. Approvals/certifications are answered from
`retrieve_product_information` only.
