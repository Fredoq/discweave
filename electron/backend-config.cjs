const localApiBaseUrl = 'http://localhost:5094'

function resolveBackendBaseUrl() {
  return process.env.CRATEBASE_API_BASE_URL || localApiBaseUrl
}

module.exports = {
  localApiBaseUrl,
  resolveBackendBaseUrl,
}
