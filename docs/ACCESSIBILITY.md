# Platform Accessibility & Inclusive Design (WCAG 2.2 AA)

This document specifies the accessibility baseline, patterns, and audit compliance mechanisms implemented across the psychological consultation booking platform.

---

## 1. Regulatory & Standards Alignment

The platform is designed and maintained to satisfy **WCAG 2.2 Level AA** compliance. For mental health and medical consulting services, clear, high-contrast, low-cognitive-load design is a fundamental patient safety requirement.

---

## 2. Global Accessibility Controls

### 2.1 Skip to Main Content Link
- Every page rendered under `RootLayout` hosts an accessible skip link as the very first tabbable element in the DOM:
  ```html
  <a href="#main-content" class="sr-only focus:not-sr-only ...">Skip to main content</a>
  ```
- Triggering `Tab` upon initial page load immediately brings the skip link into view, allowing keyboard and screen-reader users to bypass repetitive header navigation directly to `<main id="main-content">`.

### 2.2 Screen Reader Announcements (`aria-live`)
- Global announcements (action confirmations, dynamic validation alerts, and appointment status changes) are broadcast through persistent polite ARIA live regions:
  ```html
  <div id="live-region" aria-live="polite" aria-atomic="true" class="sr-only" />
  ```
- Toasts managed via `<Toaster>` employ `role="status"` and `aria-live="polite"` with explicit icon alternatives and descriptive titles.

### 2.3 Reduced Motion Preferences
- The design system respects `prefers-reduced-motion: reduce`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

---

## 3. High Consequence Confirmation Dialogs

Destructive, irreversible, or clinical actions are guarded by explicit confirmation modals ([components/feedback/confirm-dialog.tsx](file:///c:/Users/Ameer%20Al.kholany/Desktop/consulting-next.js/components/feedback/confirm-dialog.tsx)):
- **Focus Management:** Focus is automatically trapped inside the dialog upon opening; pressing `Escape` or clicking `Cancel` restores focus cleanly to the trigger button.
- **Explicit Descriptions:** Dialogs clearly state the specific affected entity and consequence rather than a generic prompt.
- **Implemented surfaces:**
  - Client cancellation & rescheduling (`CancelDialog`).
  - Consultant no-show recording (`ConfirmDialog`).
  - Clinical private notes deletion (`ConfirmDialog`).
  - Consultant availability recurring rule & exception deletion (`ConfirmDialog`).
  - Admin consultant approval, rejection, suspension, and reinstatement (`ConsultantActionsCell`).
  - Admin user status & role mutation dialogs (`RoleChangeDialog`, `StatusChangeDialog`).

---

## 4. Standardized UX Loading & Empty States

Every route maintains a resilient three-tier lifecycle:
1. **Loading State:** Skeletons mirror actual content layouts (`PageHeaderSkeleton`, `CardListSkeleton`, `TableSkeleton`) to eliminate cumulative layout shifts (CLS).
2. **Empty State:** Lists render structured `<EmptyState>` components explaining the situation and offering a clear next call-to-action.
3. **Error State:** Route error boundaries (`error.tsx`) render an actionable card showing server log reference digests and offering a retry button without exposing stack traces.

---

## 5. Automated Verification & Keyboard Walkthrough

- **Automated Axe-Core Audits:** `tests/e2e/accessibility.spec.ts` executes automated scans across all primary public views, guaranteeing zero `critical` or `serious` WCAG violations.
- **Full Keyboard Navigation:** All inputs, slot pickers, modal triggers, and buttons are accessible through standard `Tab`, `Shift+Tab`, `Space`, `Enter`, and Arrow key interactions with a 2px high-contrast focus ring.

