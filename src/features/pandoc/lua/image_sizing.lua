-- image_sizing.lua: Apply proper sizing constraints to exported images

function Image(elem)
  -- Target Mermaid diagrams specifically to constrain their size
  if elem.caption and #elem.caption > 0 then
    local caption_text = table.concat(elem.caption)
    if caption_text:match("Mermaid") then
      -- Ensure Mermaid images don't exceed page width
      -- For DOCX export, we set a reasonable max width
      if not elem.attributes["width"] then
        elem.attributes["width"] = "85%"
      end
    end
  end
  
  -- Alt text check as fallback
  if elem.alt and elem.alt[1] and elem.alt[1].text and elem.alt[1].text:match("Mermaid") then
    if not elem.attributes["width"] then
      elem.attributes["width"] = "85%"
    end
  end
  
  return elem
end
