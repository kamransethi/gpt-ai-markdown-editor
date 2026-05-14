---
title: CommonMark Stress Test
description: Tests all CommonMark-spec constructs for round-trip fidelity
---

# ATX Heading 1

## ATX Heading 2

### ATX Heading 3

#### ATX Heading 4

##### ATX Heading 5

###### ATX Heading 6

# Setext Heading Level 1

## Setext Heading Level 2

---

---

---

Regular paragraph with **bold**, *italic*, ***bold italic***, `inline code`.

Backslash escapes:

Entity references: &amp; &lt; &gt; " &amp;copy; &amp;mdash;

Paragraph with a hard line break (two trailing spaces):
continued on the next line.

> Simple blockquote paragraph.

> Multi-paragraph blockquote.
> Second paragraph in blockquote.
> > Nested blockquote.

- Unordered item 1
- Unordered item 2
  - Nested item 2a
    - Deeply nested item
  - Nested item 2b
- Unordered item 3

1. Ordered item 1
2. Ordered item 2
3. Nested ordered 2a
4. Nested ordered 2b
5. Ordered item 3

Loose unordered list (blank lines between items):

- Item A
- Item B with **bold** and `code`
- Item C

Loose ordered list:

1. Loose ordered A
2. Loose ordered B
3. Loose ordered C

  Indented code block (4 spaces)
  second line of indented block

```
Fenced backtick code block — no language
line one
line two
```

```python
def greet(name: str) -> str:
    """Return a greeting."""
    return f"Hello, {name}!"
```

```javascript
const x = 42;
console.log(`Value: ${x}`);
```

HTML block: paragraph tag.

<div class="note">


[Inline link](https://example.com)

[Inline link with title](https://example.com "Link Title")

[Reference link](https://example.com "Reference Title")

![Inline image alt](./image.png)![Image with title](./photo.png)

[https://example.com](https://example.com)

[user@example.com](mailto:user@example.com)

Inline HTML: *emphasized*, **strong**, `code span`.

Text with <span style="color: red">coloured span</span> inline.

Footnote reference[^1] in a sentence.

[^1]: Footnote content with **bold** text.
