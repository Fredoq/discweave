const cookieNameSeparators = new Set([
  '(',
  ')',
  '<',
  '>',
  '@',
  ',',
  ';',
  ':',
  '\\',
  '"',
  '/',
  '[',
  ']',
  '?',
  '=',
  '{',
  '}',
])

function splitSetCookie(value) {
  if (!value) {
    return []
  }

  const cookies = []
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === ',' && startsCookiePair(value, index + 1)) {
      cookies.push(value.slice(start, index).trim())
      start = index + 1
    }
  }

  cookies.push(value.slice(start).trim())
  return cookies.filter(Boolean)
}

function startsCookiePair(value, startIndex) {
  let index = startIndex
  while (index < value.length && isWhitespace(value[index])) {
    index += 1
  }

  const nameStart = index
  for (; index < value.length; index += 1) {
    const char = value[index]
    if (char === '=') {
      return index > nameStart
    }

    if (!isCookieNameCharacter(char)) {
      return false
    }
  }

  return false
}

function isCookieNameCharacter(char) {
  const code = char.codePointAt(0) ?? 0
  return code > 32 && code < 127 && !cookieNameSeparators.has(char)
}

function isWhitespace(char) {
  return char === ' ' || char === '\t'
}

module.exports = { splitSetCookie }
