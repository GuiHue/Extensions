# PIA for clipx ENGINEER – open items

## 1. clipx ENGINEER documentation tool — resolved

`search_clipx_help` is integrated (Workflow C, "clipx ENGINEER Help Rules"). Still to verify in tests:

- Language of the help documents (prompt: first query in user language, retry in English/German).
- Available `metadata_filter` keys (prompt forbids using them until a result shows them). If useful keys exist
  (e.g., product version, language), add them to the prompt explicitly.

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

## 4. Link handling — verify outside the prompt

The prompt now has one section for all links (**Citations and Links**); `[[ ]]` is reserved for help References.
Still to verify or decide:

- **Post-processor:** confirm the Reference replacement only matches `[[…]]` inside a link target, ideally only
  `[[*.htm]]`. Earlier prompt versions used `[[…]]` as link labels for product documents and productKnowledge
  pages; old conversation logs and tests may still expect that format.
- **`search_clipx_help` output:** the tool returns URLs and a citation id next to the Reference. The prompt tells the
  model to ignore them. Safer: strip the URLs from the tool output so they cannot be copied.
- **Product URLs:** confirm which tools actually return a product page URL (`search_product`,
  `retrieve_product_accessory_information`, `retrieve_product_variant_information`, `productDetection` via
  `productUrl` once the suggested definition is adopted). Where none is returned, products appear as plain IDs.
- **Field names:** the prompt names `download_url`; confirm the actual field names in `retrieve_product_information`
  and `productKnowledge` results.
- **User-pasted URLs (product decision):** the prompt treats a 7-digit number in a pasted URL as typed by the user
  when the user refers to that product, and never echoes the URL. Confirm this is wanted.
