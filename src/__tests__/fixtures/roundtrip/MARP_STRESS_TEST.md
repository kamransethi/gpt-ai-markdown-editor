---
marp: true
title: Specs-Driven Development
theme: default
paginate: true
style: |
  /* Remove margins/padding for full-bleed visuals */
  html, body { height:100%; margin:0; padding:0; }
  
  /* Slide utility classes */
  .no-margin { padding:0; margin:0; }
  .center { display:flex; align-items:center; justify-content:center; }
  /* Columns */
  .columns { display:flex; gap:1.25rem; align-items:center; }
  .col { flex:1; }
  .hero { width:100%; height:auto; display:block; }
  /* Small niceties for image presentation */
  img.rounded { border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,0.18); }
  /* Make text readable on darker slide fragments */
  .lead { font-size:2.1rem; line-height:1.1; }
---



## Spec Types

Mix different levels of specification depending on your goals:

- **Unit specs**: small, fast, deterministic tests for components/functions.
- **Integration specs**: verify interactions across modules and services.
- **Acceptance specs**: end-to-end behaviour described from the user's perspective.

<div>
  <p style="font-size:0.95rem; color:#666;">Use the right spec level to balance speed and confidence.</p>
</div>

---

<!-- class: no-margin -->

## Tools & Integrations

<div class="columns">
  <div class="col">
  - CI (GitHub Actions, GitLab CI)
  - Spec linters and formatters
  - Test runners (Jest, Mocha, Playwright)
  </div>
  <div class="col">
  <img src="media/proton-pass.svg" class="rounded" style="width:72%;" alt="tool" />
  </div>
</div>

---

## Example Spec (Jest)

```js
test('redirects to dashboard after login', async () => {
  const user = await createUser();
  const response = await request(app)
    .post('/login')
    .send({ email: user.email, password: user.password });

  expect(response.status).toBe(302);
  expect(response.header.location).toBe('/dashboard');
});
```

---

<!-- class: no-margin -->

<div class="columns">
  <div class="col">
  <h3>Case Study: Small Feature</h3>
  <p>1) Write acceptance spec for feature X.<br>2) Implement API + UI minimal change.<br>3) Run spec in CI and iterate.</p>
  </div>
  <div class="col">
  <img src="media/phone-ui.svg" class="rounded" style="width:100%;" alt="case" />
  </div>
</div>

---

<!-- class: center no-margin -->

Thank you — questions?


---


## Why Specs-Driven Development?

<div class="columns">
  <div class="col">
  ---

  <!-- class: center no-margin -->

Thank you — questions?

  ---

  <!-- class: no-margin -->

## Why Specs-Driven Development?

## Typical Workflow

<div class="columns">
  <div class="col">
  <ol>
    <li>Write a spec (acceptance test) describing the behaviour.</li>
    <li>Implement minimal code to satisfy the spec.</li>
    <li>Iterate on tests and implementation until green.</li>
  </ol>
  </div>
  <div class="col">
  ![Product visual](media/proton-pass.svg){.rounded style="width:100%;"}
  </div>
</div>

---

## Example Spec (Markdown)

```gherkin
Feature: Login
  Scenario: Successful login
    Given a registered user
    When they submit valid credentials
    Then they are redirected to the dashboard
```

---

<!-- class: center -->

<div style="width:85%; display:flex; gap:1rem;">
  <div style="flex:1">
  <h3>Benefits</h3>
  <ul>
    <li>Less ambiguity</li>
    <li>Faster onboarding</li>
    <li>Stronger CI guarantees</li>
  </ul>
  </div>
  <div style="flex:1">
  <h3>Tips</h3>
  <ul>
    <li>Keep specs small and focused</li>
    <li>Automate spec checks in PRs</li>
    <li>Use fixtures for repeatability</li>
  </ul>
  </div>
</div>

---

<!-- class: center no-margin -->

Thank you — questions?

