# ADR-0001 - Strategy for Siigo legacy flow

- Status: Accepted
- Date: 2026-02-27
- Owner: Engineering

## Context

The repository contains a mixed state for electronic invoicing with Siigo:

- Deprecated frontend pieces that return disabled state:
  - `src/hooks/useSiigoInvoice.js`
  - `src/services/siigoService.js`
  - `src/context/InvoicingContext.jsx`
  - `src/components/Settings/SiigoConfiguration.jsx`
- A full Edge Function implementation still present:
  - `supabase/functions/siigo-invoice/index.ts`
- Historical docs that describe Siigo as an active integration:
  - `docs/INTEGRACION_SIIGO.md`
  - `docs/FACTURACION_OPCIONAL.md`

Current product direction is explicit in multiple runtime messages: Stocky does not issue official DIAN invoices. Businesses must invoice directly in their own Siigo account.

This creates technical and product ambiguity:

- "Deprecated" code coexists with implementation-ready backend code.
- Documentation can be interpreted as "available" while UI/runtime says "not available".
- Maintenance and security surface remain larger than needed.

## Decision

Adopt a **sunset strategy** for Siigo integration inside Stocky app runtime:

1. **Stocky runtime will not offer Siigo invoice generation.**
2. **Legacy code remains temporarily only as migration buffer**, but must be isolated and clearly marked for removal.
3. **Official product behavior** is: informative receipts in Stocky + official invoicing in external provider (Siigo or equivalent) managed by each business.
4. **Single source of truth** for this decision is this ADR and updated docs index.

## Scope

In scope:

- Frontend hooks/services/components related to Siigo legacy.
- Supabase Edge Function `siigo-invoice` in this repository.
- Product/technical documentation that references Siigo integration.

Out of scope:

- External Siigo account operations for customers.
- DIAN compliance workflows outside Stocky runtime.

## Consequences

Positive:

- Clear product boundary and lower legal/operational risk.
- Reduced maintenance burden.
- Lower risk of accidental reactivation of unsupported flow.

Negative:

- Existing "optional activation" UI and old docs must be cleaned.
- Teams needing built-in e-invoicing must use external process until a new approved architecture exists.

## Implementation status (PR-4)

1. Runtime cleanup:
- Remove `useSiigoInvoice` and `siigoService` if no active consumers remain.
- Remove deprecated Siigo settings component/context paths no longer used by UI.

2. Backend cleanup:
- Move `supabase/functions/siigo-invoice/index.ts` to archive folder or remove it.
- Ensure deploy pipeline does not deploy this function.

3. Documentation cleanup:
- Mark `docs/INTEGRACION_SIIGO.md` and `docs/FACTURACION_OPCIONAL.md` as archived or replace with migration note.
- Keep one clear guide: "official invoicing is external to Stocky runtime".

4. Safeguards:
- Add regression tests for runtime behavior: no internal electronic invoice generation path exposed.
- Add CI grep/check to prevent reintroducing active Siigo generation endpoints without a new ADR.

## Acceptance criteria

- No active UI action in Stocky can trigger Siigo invoice creation.
- No deployed backend function in Stocky handles Siigo invoice creation.
- Documentation is consistent across README + docs index + invoicing guides.

## Rollback strategy

If product strategy changes, a new ADR must:

- define legal/compliance ownership,
- define provider abstraction and tenancy boundaries,
- define secure secret management and audit requirements,
- re-enable functionality via explicit feature flag and phased rollout.
