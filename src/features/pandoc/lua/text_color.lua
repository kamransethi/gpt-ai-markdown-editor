-- text_color.lua: Handle text color spans
-- Processes elements with style attributes for text color (color:#RRGGBB)

function Span(elem)
  -- Check if span has style attribute with color
  if elem.attributes and elem.attributes["style"] then
    local style = elem.attributes["style"]
    local color = string.match(style, "color:([^;]+)")
    
    if color then
      -- Store color in a custom attribute for Pandoc to handle
      -- Word processors will need to apply this via template or filter
      elem.attributes["style"] = style
      elem.attributes["data-text-color"] = color
      
      -- Try to add color attribute if it's a valid format
      if string.match(color, "#%x%x%x%x%x%x") then
        -- This is a hex color - keep it for template processing
        elem.attributes["data-color-hex"] = color
      end
    end
  end
  
  return elem
end

-- Also handle strong/em with color attributes
function Strong(elem)
  return process_element_color(elem)
end

function Emph(elem)
  return process_element_color(elem)
end

-- Helper to process any element with color attributes
function process_element_color(elem)
  if elem.attributes and elem.attributes["style"] then
    local style = elem.attributes["style"]
    local color = string.match(style, "color:([^;]+)")
    if color then
      elem.attributes["data-text-color"] = color
      if string.match(color, "#%x%x%x%x%x%x") then
        elem.attributes["data-color-hex"] = color
      end
    end
  end
  return elem
end
