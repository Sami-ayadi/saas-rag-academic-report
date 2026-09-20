import { db } from '@/lib/db'

const STOPWORDS = new Set([
  'avec', 'dans', 'pour', 'par', 'des', 'les', 'une', 'sur', 'est', 'sont', 'aux', 'the', 'and', 'for', 'from',
  'that', 'this', 'lesquels', 'ainsi', 'comme', 'plus', 'section', 'chapitre', 'rapport', 'projet', 'stage',
])

function terms(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g)
    ?.filter((term) => !STOPWORDS.has(term)) ?? []
}

function scoreChunk(content: string, queryTerms: string[]) {
  const haystack = ` ${terms(content).join(' ')} `
  const unique = [...new Set(queryTerms)]
  let score = 0
  for (const term of unique) {
    const occurrences = haystack.split(` ${term}`).length - 1
    score += Math.min(occurrences, 4) * (term.length >= 8 ? 3 : 2)
  }
  for (let index = 0; index < unique.length - 1; index++) {
    if (haystack.includes(`${unique[index]} ${unique[index + 1]}`)) score += 5
  }
  return score
}

export interface RetrievedSourceChunk {
  documentId: string | null
  sourceName: string
  pageNumber: number | null
  locator: string | null
  content: string
  score: number
}

export async function retrieveRelevantSourceChunks(projectId: string, query: string, limit = 16): Promise<RetrievedSourceChunk[]> {
  const candidates = await db.embedding.findMany({
    where: { projectId, document: { role: 'PROJECT_EVIDENCE', status: 'processed' } },
    take: 1_000,
    orderBy: [{ documentId: 'asc' }, { chunkIndex: 'asc' }],
    select: {
      documentId: true,
      pageNumber: true,
      locator: true,
      content: true,
      document: { select: { originalName: true } },
    },
  })
  const queryTerms = terms(query)
  return candidates
    .map((candidate) => ({
      documentId: candidate.documentId,
      sourceName: candidate.document?.originalName ?? 'Source sans nom',
      pageNumber: candidate.pageNumber,
      locator: candidate.locator,
      content: candidate.content,
      score: scoreChunk(candidate.content, queryTerms),
    }))
    .sort((left, right) => right.score - left.score || (left.pageNumber ?? 0) - (right.pageNumber ?? 0))
    .slice(0, Math.max(1, Math.min(limit, 40)))
}

export function sourceChunksForPrompt(chunks: RetrievedSourceChunk[]) {
  return chunks.map((chunk) => {
    const page = chunk.pageNumber ? `, page PDF ${chunk.pageNumber}` : ''
    return `[SOURCE ${chunk.sourceName}${page}, repère ${chunk.locator ?? 'non paginé'}]\n${chunk.content}`
  })
}

