---
title: GFM Stress Test
description: Tests all GitHub Flavored Markdown constructs for round-trip fidelity
---

## Tables

| Left Aligned | Center Aligned | Right Aligned | Default    |
| :------------ | :--------------: | -------------: | ---------- |
| Cell 1,1     | Cell 1,2       | Cell 1,3      | Cell 1,4   |
| Cell 2,1     | Cell 2,2       | Cell 2,3      | Cell 2,4   |
| **Bold**     | *Italic*       | `code`        | ~~strike~~ |

Empty cells in table:

| Column A | Column B | Column C |
| -------- | -------- | -------- |
| filled   |          |          |
|          | filled   |          |
|          |          |          |

Single-column table:

| Only Column |
| ----------- |
| Row 1       |
| Row 2       |

## Task Lists

- [x] Completed task
- [ ] Incomplete task
- [x] Completed with **bold** text
- [ ] Incomplete with *italic* and `code`
  - [x] Nested completed subtask
  - [ ] Nested incomplete subtask
- [ ] Task with [a link](https://example.com)

## Strikethrough

~~Single word~~ strikethrough.

Text with ~~inline strikethrough phrase~~ and normal text.

~~Entire sentence struck through.~~

## Extended Autolinks

[https://example.com/path?query=value](https://example.com/path?query=value)

[www.github.com/user/repo](http://www.github.com/user/repo)

## GitHub Alerts

> [!NOTE]
> Informational note. Useful for supplementary details.

> [!TIP]
> Helpful tip for users discovering shortcuts.

> [!IMPORTANT]
> Key information the user must not miss.

> [!WARNING]
> Warning about potential issues requiring attention.

> [!CAUTION]
> Caution about actions with negative consequences.

## Inline and Block HTML

Inline: <mark>highlighted</mark>, <kbd>, <sup>, <sub>.

<details>

Content inside the collapsible block.

- List item inside details
- Another list item

<figure>

## Footnotes

Here is a sentence with a footnote[^1].

Another sentence with a named footnote[^named].

[^1]: First footnote content with plain text.
[^named]: Named footnote with **bold** and `inline code`.

## Combined GFM Features

| Task          | Status                      | Notes  |
| ------------- | --------------------------- | ------ |
| **Bold cell** | ~~Done~~                    | `code` |
| *Italic*      | [Link](https://example.com) | plain  |

- [x] Task with ~~strikethrough~~ inside
- [ ] Task with **bold** and *italic* and `code`
- [x] Task with [link](https://example.com) inside

> [!NOTE]
> Alert with a table inside:
> | A   | B   |
> | --- | --- |
> | 1   | 2   |
