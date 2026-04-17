-- table_formatting.lua: Normalize HTML line breaks emitted in markdown table cells.

-- Convert BR tags followed by bullet markers into proper newlines for list item recognition
function RawInline(el)
  if el.format ~= "html" then
    return nil
  end

  local text = (el.text or ""):lower()
  if text:match("^<br%s*/?>$") then
    -- Convert <br> to LineBreak, which will be handled by Pandoc
    return pandoc.LineBreak()
  end

  return nil
end

-- Process Para nodes in table cells to convert <br> + bullet patterns into proper markdown
-- This ensures bullets after line breaks are recognized as separate list items
function Para(el)
  -- Check if this paragraph contains line breaks followed by bullet-like content
  -- If it does, convert it to a BulletList
  if should_convert_to_bullet_list(el) then
    return convert_para_to_bullet_list(el)
  end
  return el
end

-- Detect if a paragraph should be converted to a bullet list
-- Returns true if paragraph contains multiple items separated by LineBreak
function should_convert_to_bullet_list(para)
  if not para.content or #para.content < 3 then
    return false
  end
  
  local has_line_break = false
  local has_bullet_pattern = false
  
  for i, el in ipairs(para.content) do
    if el.t == "LineBreak" then
      has_line_break = true
    end
    -- Check if content starts with a bullet marker
    if el.t == "Str" then
      local text = el.text or ""
      if text:match("^[-*+]%s+") or text:match("^%d+%.%s+") then
        has_bullet_pattern = true
      end
    end
  end
  
  return has_line_break and has_bullet_pattern
end

-- Convert a paragraph with line breaks and bullets into a BulletList
function convert_para_to_bullet_list(para)
  local items = {}
  local current_item = {}
  
  for i, el in ipairs(para.content) do
    if el.t == "LineBreak" then
      -- Group previous content as a list item
      if #current_item > 0 then
        table.insert(items, pandoc.ListItem(pandoc.Para(current_item)))
        current_item = {}
      end
    else
      table.insert(current_item, el)
    end
  end
  
  -- Add final item
  if #current_item > 0 then
    table.insert(items, pandoc.ListItem(pandoc.Para(current_item)))
  end
  
  -- Convert to BulletList if we have items
  if #items > 0 then
    return pandoc.BulletList(items)
  end
  
  return para
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
