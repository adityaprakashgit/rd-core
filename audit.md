# audit.md

## Purpose
This is the mandatory operating rulebook for product audits requested by Product Managers, Security, or Engineering leads.

When asked to perform an audit, the reviewer must follow this SOP and return a findings-first report with evidence, owners, and release decision.

This baseline is pragmatic and implementation-focused. It is not legal advice.

---

## 1) Mandatory Audit Protocol (When Asked for Audit)
1. Confirm audit scope: feature(s), API surface, routes, environments, and release target.
2. Run audit by domain in this order:
   - International data
   - Security
   - API checks
   - Routing checks
   - PM readiness
3. Record findings in severity order (`P0` to `P3`).
4. Attach evidence for every finding (path, endpoint, test output, logs, or screenshot reference).
5. Assign fix ownership and ETA for every non-accepted finding.
6. Produce release gate recommendation:
   - `SHIP`
   - `SHIP_WITH_EXCEPTIONS`
   - `DO_NOT_SHIP`

No audit is complete without the release gate recommendation.

---

## 2) Severity Model (Dual Mapping + SLA)
Use both internal product severity and standard security severity in all reports.

| Product Severity | Standard Severity | Meaning | Target SLA |
|---|---|---|---|
| P0 | Critical | Active exploit, data breach risk, or hard blocker to safe release | Immediate hotfix / same day |
| P1 | High | Serious security/compliance/functional risk likely to impact users or release | 1-3 business days |
| P2 | Medium | Important weakness with workaround; should be fixed in scheduled sprint | 1-2 sprints |
| P3 | Low | Minor issue, low risk, hygiene improvement | Backlog with owner |

Blockers are:
- `P0/Critical`
- `P1/High`

---

## 3) Compliance Baseline (Global)
Every audit must use this global baseline:
- GDPR-aligned data protection controls
- SOC 2-style security and operational controls
- OWASP API Top 10 style API risk checks
- ISO 27001-style control hygiene checks

If region-specific requirements are unknown:
- add explicit flag: `Regional legal review required`
- do not silently assume compliance.

---

## 4) Required Audit Domains and Checks

### 4.1 International Data
Mandatory checks:
- Data residency and cross-border transfer path
- Retention and deletion behavior
- Consent/legal basis for personal data processing
- Access logging and traceability for sensitive records
- PII minimization in payloads, logs, and exports

Minimum evidence examples:
- Data retention config or policy reference
- API payload/log sample showing PII treatment
- Access/audit trail output

### 4.2 Security
Mandatory checks:
- Authentication and authorization controls
- Tenant/company scope enforcement
- Secrets handling and storage
- Encryption in transit and at rest
- Input validation and sanitization
- Rate limiting and abuse protection

Minimum evidence examples:
- Role/scope checks in route handlers
- Secret source verification (no hardcoded credentials)
- Validation error behavior for unsafe input

### 4.3 API Checks
Mandatory checks:
- Request/response schema consistency
- Error contract stability (shape and code)
- Idempotency where required
- Pagination/filter safety
- Versioning and backward compatibility

Minimum evidence examples:
- Route response samples
- API contract/test snapshots
- Breaking change notes (if any)

### 4.4 Routing Checks
Mandatory checks:
- Route protection by role and session state
- Tenant/company boundary enforcement
- Route-level data leakage review
- Correct handling of unauthorized/forbidden/not found

Minimum evidence examples:
- Protected route behavior checks
- Cross-tenant access rejection evidence
- Status code and payload samples

### 4.5 Product Manager Readiness
Mandatory checks:
- User-facing impact of each finding
- Failure mode clarity and recovery path
- Rollback strategy for release risk
- Acceptance gate recommendation

Minimum evidence examples:
- UX failure scenario summary
- Rollback/feature-flag plan reference
- Release gate rationale

---

## 5) Standard Audit Output Contract
All audits must output the following structures.

### 5.1 Findings[]
Each finding entry must contain:
- `severity_p`
- `severity_std`
- `domain`
- `issue`
- `impact`
- `evidence`
- `fix`
- `owner`
- `eta`

### 5.2 GateDecision
Allowed values:
- `SHIP`
- `SHIP_WITH_EXCEPTIONS`
- `DO_NOT_SHIP`

### 5.3 ExceptionRecord
Required if blockers remain and release is not `DO_NOT_SHIP`.

Must include:
- Blocker IDs
- Business justification
- Explicit approver
- Mitigation controls
- Time-bound cleanup commitment

---

## 6) Required Audit Report Format (Findings-First)

### Header Metadata
- Audit date
- Scope
- Branch/build identifier
- Auditor(s)
- Environment(s) reviewed

### Findings (ordered by severity)
Use this table format:

| ID | severity_p | severity_std | domain | issue | impact | evidence | fix | owner | eta |
|---|---|---|---|---|---|---|---|---|---|

### Blockers Section
List unresolved blockers only:
- `P0/Critical`
- `P1/High`

For each blocker include:
- why it blocks release
- required fix condition

### Decision Section
One of:
- `SHIP`
- `SHIP_WITH_EXCEPTIONS`
- `DO_NOT_SHIP`

Include rationale in plain product language.

---

## 7) Release Gate Rules (Non-Negotiable)
- If any unresolved `P0/Critical` exists: decision must be `DO_NOT_SHIP`.
- If unresolved `P1/High` exists:
  - default is `DO_NOT_SHIP`
  - `SHIP_WITH_EXCEPTIONS` allowed only with signed ExceptionRecord.
- `SHIP` allowed only when no unresolved blockers remain.

---

## 8) Language and Quality Rules (Non-Negotiable)
- Do not conclude with vague statements like “looks good”.
- Do not report findings without evidence links/references.
- Do not approve release when blockers remain without explicit exception sign-off.
- Use PM-readable language first; define security terms briefly when needed.
- Keep findings actionable: each must include fix owner and ETA.

---

## 9) Minimum Example Findings (One per Domain)

### International Data Example
- `severity_p`: P1
- `severity_std`: High
- `domain`: international_data
- `issue`: Data export endpoint lacks retention-bound deletion check
- `impact`: Potential non-compliance with retention requirements
- `evidence`: `/api/report/export` retention path review + missing guard test
- `fix`: Add retention policy guard before export generation
- `owner`: Backend
- `eta`: 2 business days

### Security Example
- `severity_p`: P0
- `severity_std`: Critical
- `domain`: security
- `issue`: Missing company-scope check on privileged route
- `impact`: Cross-tenant data access risk
- `evidence`: Route handler path + reproducer request
- `fix`: Enforce tenant scope middleware/guard
- `owner`: Backend
- `eta`: Same day

### API Example
- `severity_p`: P2
- `severity_std`: Medium
- `domain`: api
- `issue`: Inconsistent error payload shape across similar endpoints
- `impact`: UI recovery flow breaks on edge cases
- `evidence`: Response samples from create/update parity paths
- `fix`: Normalize error contract (`error`, `details`, `code`)
- `owner`: Backend
- `eta`: Next sprint

### Routing Example
- `severity_p`: P1
- `severity_std`: High
- `domain`: routing
- `issue`: Admin route is reachable without role gate
- `impact`: Privilege escalation path
- `evidence`: Route policy test + direct request trace
- `fix`: Add role-based guard and regression test
- `owner`: Platform
- `eta`: 1 business day

### PM Readiness Example
- `severity_p`: P2
- `severity_std`: Medium
- `domain`: pm_readiness
- `issue`: Failure state lacks user recovery hint
- `impact`: Increased support load and task abandonment
- `evidence`: Mobile execution path screenshot + UX test note
- `fix`: Add inline error hint + retry CTA
- `owner`: Frontend
- `eta`: Next sprint

---

## 10) Audit Completion Checklist
An audit is complete only when all are true:
- Findings are listed in severity order.
- Every finding has evidence, owner, and ETA.
- Blockers are explicitly listed.
- Gate decision is present and justified.
- ExceptionRecord is included when required.
- Regional legal uncertainty is explicitly flagged when applicable.

