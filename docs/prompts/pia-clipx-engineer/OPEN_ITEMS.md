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

Suggested definitions for the two tools we control: `tool-definitions-suggested.json`
(`respond_to_user`, `productDetection`). When adopted, update `system-prompt.md`:

- Turn Protocol: add rules for `reason` (mapping from the referral/stock topics) and `product_ids`.
- Product Detection Rules: use `confidence` (EXACT/HIGH → accept, MEDIUM → ask, LOW/empty → ask for article number)
  and cite `productUrl`.
- `productDetection` implementation must actually return productId (string), productName, productUrl, score,
  confidence — the JSON only documents the contract.

MCP tools (not under our control):

- `retrieve_property_value_match.language` says to detect the language from the query text. The prompt instead
  runs one call per language seen in the search results and writes the query term in that language. Both agree
  only if the query term is translated per call.

## 3. Capabilities removed (users will ask)

Availability/stock and delivery checks are not offered in clipx ENGINEER (product decision); the prompt contains
no availability logic. If users ask anyway, PIA states that she has no access to that information (no referral).

No tools for CAD data, images, software downloads, compliance documents. These are referred to the local Phoenix Contact representative. Approvals/certifications are answered from
`retrieve_product_information` only.
