const localApiBaseUrl = 'http://localhost:5094'

function resolveBackendBaseUrl() {
  return process.env.DISCWEAVE_API_BASE_URL || localApiBaseUrl
}

module.exports = {
  localApiBaseUrl,
  resolveBackendBaseUrl,
}
