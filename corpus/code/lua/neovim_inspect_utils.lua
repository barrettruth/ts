-- Apostrophizes the string if it has quotes, but not aphostrophes
-- Otherwise, it returns a regular quoted string
local function smartQuote(str)
  if match(str, '"') and not match(str, "'") then
    return "'" .. str .. "'"
  end
  return '"' .. gsub(str, '"', '\\"') .. '"'
end

-- \a => '\\a', \0 => '\\0', 31 => '\31'
local shortControlCharEscapes = {
  ['\a'] = '\\a',
  ['\b'] = '\\b',
  ['\f'] = '\\f',
  ['\n'] = '\\n',
  ['\r'] = '\\r',
  ['\t'] = '\\t',
  ['\v'] = '\\v',
  ['\127'] = '\\127',
}
local longControlCharEscapes = { ['\127'] = '\127' }
for i = 0, 31 do
  local ch = char(i)
  if not shortControlCharEscapes[ch] then
    shortControlCharEscapes[ch] = '\\' .. i
    longControlCharEscapes[ch] = fmt('\\%03d', i)
  end
end

local function escape(str)
  return (
    gsub(
      gsub(gsub(str, '\\', '\\\\'), '(%c)%f[0-9]', longControlCharEscapes),
      '%c',
      shortControlCharEscapes
    )
  )
end

local luaKeywords = {}
for k in
  ([[ and break do else elseif end false for function goto if
             in local nil not or repeat return then true until while
]]):gmatch('%w+')
do
  luaKeywords[k] = true
end

local function isIdentifier(str)
  return type(str) == 'string'
    -- identifier must start with a letter and underscore, and be followed by letters, numbers, and underscores
    and not not str:match('^[_%a][_%a%d]*$')
    -- lua keywords are not valid identifiers
    and not luaKeywords[str]
end

local flr = math.floor
local function isSequenceKey(k, sequenceLength)
  return type(k) == 'number' and flr(k) == k and 1 <= k and k <= sequenceLength
end

local defaultTypeOrders = {
  ['number'] = 1,
  ['boolean'] = 2,
  ['string'] = 3,
  ['table'] = 4,
  ['function'] = 5,
  ['userdata'] = 6,
  ['thread'] = 7,
}

local function sortKeys(a, b)
  local ta, tb = type(a), type(b)

  -- strings and numbers are sorted numerically/alphabetically
  if ta == tb and (ta == 'string' or ta == 'number') then
    return a < b
  end

  local dta = defaultTypeOrders[ta] or 100
  local dtb = defaultTypeOrders[tb] or 100
  -- Two default types are compared according to the defaultTypeOrders table

  -- custom types are sorted out alphabetically
  return dta == dtb and ta < tb or dta < dtb
end
