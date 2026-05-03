# Table Bullets Fixture

Canonical fixture for Playwright table-bullet component tests.
Load this file to seed the editor, then assert serialization behavior.

## Single-level bullets in table

| Feature | Details |
| ------- | ------- |
| Bullets | - Alpha<br>- Beta<br>- Gamma |
| Plain | Just text here |
| Solo | - Only one bullet |

## Ordered list in table

| Step | Notes |
| ---- | ----- |
| Procedure | 1. First<br>2. Second<br>3. Third |
| Result | Pass |

## Nested bullets in table

| Heading | Nested Content |
| ------- | -------------- |
| Depth | - Level 1<br>  + Level 2<br>    * Level 3 |
| Flat | - Only flat |

## Mixed content in same cell (text + bullets)

| Cell | Content |
| ---- | ------- |
| Mixed | Intro text<br>- Bullet A<br>- Bullet B<br>Trailing text |
| Normal | Regular text |

## Multiple bullet cells per row

| Left | Middle | Right |
| ---- | ------ | ----- |
| - A1<br>- A2 | - B1<br>- B2 | - C1<br>- C2 |
| Plain | Plain | Plain |

## Task list items in table

| Task | Status |
| ---- | ------ |
| Items | - [ ] Unchecked<br>- [x] Checked<br>- [ ] Another |
| Done | All complete |

## Empty and sparse cells

| A | B | C |
| - | - | - |
| - Bullet | | Plain |
| | - Bullet 2 | |
| Last | - End bullet | Final |
