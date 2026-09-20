import { describe, expect, it } from 'vitest'

import { chunkExtractedDocument, extractDocument } from './document-extraction'

describe('extractDocument', () => {
  it('extracts bounded text chunks with source locators', async () => {
    const result = await extractDocument('.txt', Buffer.from('Titre\n\n' + 'Une preuve exploitable. '.repeat(180)))
    const chunks = chunkExtractedDocument(result)
    expect(result.pages).toHaveLength(1)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]).toEqual(expect.objectContaining({ pageNumber: null, locator: expect.any(String) }))
    expect(chunks.map((chunk) => chunk.content).join(' ')).toContain('preuve exploitable')
  })
})
