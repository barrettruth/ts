local function get_content_length(ptr, start, len)
  local state = 'name'
  local i, end_ = start, start + len
  local j, name = 1, 'content-length'
  local buf = strbuffer.new()
  local digit = true
  while i < end_ do
    local c = ptr[i]
    if state == 'name' then
      if c >= 65 and c <= 90 then -- lower case
        c = c + 32
      end
      if (c == 32 or c == 9) and j == 1 then -- luacheck: ignore 542
        -- skip OWS for compatibility only
      elseif c == name:byte(j) then
        j = j + 1
      elseif c == 58 and j == 15 then
        state = 'colon'
      else
        state = 'invalid'
      end
    elseif state == 'colon' then
      if c ~= 32 and c ~= 9 then -- skip OWS normally
        state = 'value'
        i = i - 1
      end
    elseif state == 'value' then
      if c == 13 and ptr[i + 1] == 10 then -- must end with \r\n
        local value = buf:get()
        if digit then
          return vim._assert_integer(value)
        end
        error('value of Content-Length is not number: ' .. value)
      else
        buf:put(string.char(c))
      end
      if c < 48 and c ~= 32 and c ~= 9 or c > 57 then
        digit = false
      end
    elseif state == 'invalid' then
      if c == 10 then -- reset for next line
        state, j = 'name', 1
      end
    end
    i = i + 1
  end
  local header = strbuffer.new()
  for k = start, end_ - 1 do
    header:put(string.char(ptr[k]))
  end
  error('Content-Length not found in header: ' .. header:tostring())
end
