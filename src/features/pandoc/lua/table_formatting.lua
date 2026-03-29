-- table_formatting.lua: Normalize HTML line breaks emitted in markdown table cells.

function RawInline(el)
  if el.format ~= "html" then
    return nil
  end

  local text = (el.text or ""):lower()
  if text:match("^<br%s*/?>$") then
    return pandoc.LineBreak()
  end

  return nil
end


-- Apply fine gray borders to tables when no reference DOCX template is used.
-- This provides a reasonable default for exported .docx files so tables
-- aren't borderless when the user hasn't supplied a reference doc.
function Table(el)
  -- Only apply for DOCX output
  if FORMAT and FORMAT:match("docx") then
    local applyBorders = false

    -- Safely detect metadata flag set by the caller (see documentExport.ts)
    if PANDOC_STATE and PANDOC_STATE.meta then
      local ok, val = pcall(function() return PANDOC_STATE.meta["no_reference_doc"] end)
      if ok and val then
        applyBorders = true
      end
    end

    if applyBorders then
      -- Very fine gray border and collapse inner borders
      local tableStyle = "border: 0.5pt solid rgb(128,128,128); border-collapse: collapse; border-spacing: 0; margin: 6pt 0;"

      -- Instead of trying to mutate the Table userdata (which can raise
      -- 'Unknown key' errors in some Pandoc versions), wrap the table in
      -- a Div with an inline style attribute. This avoids mutating the
      -- Table object directly and prevents runtime errors in the Lua filter.
      local attr = pandoc.Attr("", {}, { style = tableStyle })
      return pandoc.Div({ el }, attr)
    end
  end

  return el
end
