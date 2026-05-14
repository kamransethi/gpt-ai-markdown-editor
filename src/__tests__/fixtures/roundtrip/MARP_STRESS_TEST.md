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


---

## Tools &amp; Integrations

<div class="columns">


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

<div class="columns">


---

Thank you — questions?

---

## Why Specs-Driven Development?

<div class="columns">


Thank you — questions?

---

## Why Specs-Driven Development?

## Typical Workflow

<div class="columns">


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

<div style="width:85%; display:flex; gap:1rem;">


---

Thank you — questions?
