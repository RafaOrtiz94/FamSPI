---
name: bc-offer-template-repair
description: Audit and repair Business Case offer rows against the current TABLA BASE BC Google Sheet when products, IDs, ordering, or section placement diverge.
---

# Business Case Offer Template Repair

Use for Business Case offer Sheet/PDF discrepancies. The authoritative source
for new Business Case product identity, order, and material grouping is Google
Sheet `1FfB2ycMqvXAa2hLYQXFn_D1UZwfSnM_Rd77SWbtKo08` (`TABLA BASE BC`). Its
exported local mirror is `backend/Mapeador_Sheets/TABLA BASE BC.xlsx`; catalog
data supplies commercial metadata only.

## Procedure

1. Read `backend/src/modules/business-case/CONTEXT.md` and inspect the real
   offer payload, generated Google Sheet, and selected equipment. Do not
   migrate or regenerate historical BCs unless the user explicitly requests it.
2. Audit one equipment tab at a time. Compare source row number, product ID,
   and normalized product name against the target offer section. Do not use
   aggregate counts as the only proof.
3. Preserve distinct template rows that share an ID when their labels differ.
   Remove a `sheet_template` fallback only when equipment, ID, and normalized
   label match a catalog-backed row.
4. For material rows, use the section headers in the base sheet (for example
   `CONSUMIBLES` and `SISTEMA PARA ELECTROLITOS-ISE`), not keyword matching.
5. After XLSX-to-Google conversion, write product names and IDs to their
   expected offer ranges and read them back. Conversion success alone is not
   evidence that every row survived.
6. Regenerate only the affected existing offers after the comparison passes.
   Preserve pricing and lead-time values. Do not overwrite accepted data
   without explicit authorization.

## Verification

- Check each template row exactly once in its intended section and sequence.
- Report missing, extra, displaced, and duplicate rows separately.
- Run the relevant Business Case offer and sheet-mapping Jest tests plus ESLint.
- For live Google Sheets, verify the written `B:C` product/ID rows after
  regeneration.

## Boundaries

- Do not alter catalog IDs merely to compensate for a template discrepancy.
- Do not delete production rows through SQL unless the user explicitly asks;
  use the synchronized module workflow after confirming equivalence.
