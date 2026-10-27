/** JSON request/response helpers shared by the Host routes. */

/** Body ceiling for the settings API; the payload is a group list, never a file transfer. */
export const MAX_BODY_BYTES = 512 * 1024

/** A failure the route layer reports with an explicit status. */
export class HttpError extends Error {
  /**
   * @param status - HTTP status to answer with.
   * @param code - stable machine-readable code for the page.
   * @param message - user-facing explanation.
   */
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * Answer with one JSON body.
 * @param res - the server response.
 * @param status - HTTP status.
 * @param body - JSON-serializable payload.
 */
export function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(payload)
}

/**
 * Read and parse a JSON request body.
 * @param req - the server request.
 * @returns the parsed payload, or `{}` for an empty body.
 */
export async function readJsonBody(req) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) throw new HttpError(413, 'body-too-large', `request body exceeds ${MAX_BODY_BYTES} bytes`)
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'body-invalid', 'request body must be JSON')
  }
}

/**
 * Reject a request the connection admission refuses, so the page sees 401/403 rather than a partial answer.
 * @param ctx - Host context carrying the `connection` service.
 * @param req - the server request.
 * @param res - the server response.
 * @returns whether the request was already answered.
 */
export function refused(ctx, req, res) {
  const rejection = ctx.connection.requestRejection(req)
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.end()
  return true
}
