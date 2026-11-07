/** Append-only debug log beside the configuration, rotated and serialized so lifecycle tracing cannot grow unbounded. */

import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Upper bound in bytes before the log keeps only its own tail. */
const CAP_BYTES = 256 * 1024

/** Tail length in bytes kept when the cap is reached. */
const KEEP_BYTES = 128 * 1024

/**
 * Create the trace sink for one file.
 * Writes are chained, so lines keep their order even when several emit in the same tick,
 * and the file is rotated to its tail instead of growing unbounded.
 * @param file - absolute path of the log file.
 * @returns a function that appends one line; storage failures are swallowed.
 */
export function createDebugLog(file) {
  // -1 = unknown yet; the first successful write measures it.
  let chain = Promise.resolve(-1)
  void mkdir(dirname(file), { recursive: true }).catch(() => {})
  return function trace(line) {
    const text = `${new Date().toISOString()} ${line}\n`
    chain = chain.then((size) => append(file, text, size))
  }
}

/** Append one line, rotating to the kept tail when the cap is reached; return the new size. */
async function append(file, text, size) {
  try {
    if (size < 0) {
      try {
        size = (await stat(file)).size
      } catch {
        size = 0
      }
    }
    if (size > CAP_BYTES) {
      const current = await readFile(file)
      const tail = current.subarray(Math.max(0, current.length - KEEP_BYTES))
      await writeFile(file, tail)
      size = tail.length
    }
    await appendFile(file, text)
    return size + Buffer.byteLength(text)
  } catch {
    return size < 0 ? 0 : size
  }
}
