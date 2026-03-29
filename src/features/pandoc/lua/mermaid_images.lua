-- mermaid_images.lua: Handle Mermaid diagram blocks
-- This filter marks mermaid code blocks so they can be identified and replaced with images
-- The actual replacement happens in TypeScript before passing to Pandoc

function CodeBlock(elem)
  -- Check if this is a mermaid code block
  if elem.classes and contains(elem.classes, "mermaid") then
    -- Mark it with a special attribute for later processing/identification
    if not elem.attributes then
      elem.attributes = {}
    end
    elem.attributes["data-diagram-type"] = "mermaid"
    elem.attributes["data-mermaid-code"] = table.concat(elem.content or {}, "\n")
  end
  
  return elem
end

-- Helper function to check if value is in table
function contains(table, val)
  for _, v in pairs(table) do
    if v == val then
      return true
    end
  end
  return false
end
