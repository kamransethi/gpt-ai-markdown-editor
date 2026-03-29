-- github_alerts.lua: Convert GitHub callout blockquotes into styled alerts with emojis and colors.

local ALERT_CONFIG = {
  note = {
    emoji = "📝",
    color = "#0969DA",  -- blue
    bgcolor = "#E7F0FF", -- light blue background
    label = "NOTE",
  },
  tip = {
    emoji = "💡",
    color = "#1A7F0F",  -- green
    bgcolor = "#E6F5E8", -- light green background
    label = "TIP",
  },
  warning = {
    emoji = "⚠️",
    color = "#9E6A03",  -- orange
    bgcolor = "#FFF4E6", -- light orange background
    label = "WARNING",
  },
  caution = {
    emoji = "⚠️",
    color = "#D1242F",  -- red
    bgcolor = "#FFE4E8", -- light red background
    label = "CAUTION",
  },
  important = {
    emoji = "❗",
    color = "#8B2C2C",  -- dark red/brown
    bgcolor = "#F4E5E5", -- light brown background
    label = "IMPORTANT",
  },
}

local function first_inline(block)
  if not block or not block.content or #block.content == 0 then
    return nil
  end
  return block.content[1]
end

local function remove_alert_marker(block)
  local inline = first_inline(block)
  if not inline or inline.t ~= "Str" then
    return nil
  end

  local marker = inline.text:match("^%[!([A-Za-z]+)%]")
  if not marker then
    return nil
  end

  local alert_type = string.lower(marker)
  if not ALERT_CONFIG[alert_type] then
    return nil
  end

  inline.text = inline.text:gsub("^%[![A-Za-z]+%]", "")
  if inline.text == "" then
    table.remove(block.content, 1)
    if block.content[1] and block.content[1].t == "Space" then
      table.remove(block.content, 1)
    end
  end

  return alert_type
end

function BlockQuote(elem)
  if not elem.content or #elem.content == 0 then
    return elem
  end

  local first_block = elem.content[1]
  if not first_block or (first_block.t ~= "Para" and first_block.t ~= "Plain") then
    return elem
  end

  local alert_type = remove_alert_marker(first_block)
  if not alert_type then
    return elem
  end

  local config = ALERT_CONFIG[alert_type]
  local label = config.label
  local emoji = config.emoji

  -- Create colored label with emoji: "📝 NOTE:"
  local label_content = {
    pandoc.Str(emoji .. " " .. label .. ":"),
  }

  -- Insert colored label at the beginning
  table.insert(first_block.content, 1, pandoc.Space())
  table.insert(first_block.content, 1, pandoc.Strong(label_content))

  -- Wrap the blockquote in a Div with alert type class and inline styling
  -- The border-left provides visual framing for DOCX export
  local div = pandoc.Div(elem.content, {
    class = "alert alert-" .. alert_type
  })
  
  -- Add custom attributes for styling (color-coded left border)
  div.attributes = div.attributes or {}
  div.attributes["style"] = "border-left: 4px solid " .. config.color .. "; padding-left: 12px; margin: 8px 0;"

  return div
end
