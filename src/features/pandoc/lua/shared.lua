-- shared.lua: Common utility functions for Pandoc filters

-- Check if a value is in a table
function contains(table, val)
  for _, v in pairs(table) do
    if v == val then
      return true
    end
  end
  return false
end

-- Get attribute from element
function get_attr(elem, key)
  if elem.attributes and elem.attributes[key] then
    return elem.attributes[key]
  end
  return nil
end

-- Set attribute on element
function set_attr(elem, key, value)
  if not elem.attributes then
    elem.attributes = {}
  end
  elem.attributes[key] = value
  return elem
end

-- Return shared utilities
return {
  contains = contains,
  get_attr = get_attr,
  set_attr = set_attr
}
