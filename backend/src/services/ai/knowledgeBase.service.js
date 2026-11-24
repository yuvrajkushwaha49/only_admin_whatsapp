import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeQuery, isUsingFallback } from '../../database/db.js';
import logger from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '../../../knowledge-base');

/**
 * Knowledge Base Retrieval and Indexing Service
 */

/**
 * Recursively find all markdown files in the knowledge-base directory
 */
function getMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getMarkdownFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Split a markdown document into meaningful chunks based on headers (#, ##, ###)
 */
function chunkMarkdown(content, fileName, category) {
  const sections = content.split(/\n(?=#{1,3}\s+)/);
  const chunks = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    // Extract title if present
    const headerMatch = section.match(/^#{1,3}\s+([^\n]+)/);
    const sectionTitle = headerMatch ? headerMatch[1].trim() : `${fileName} Part ${i + 1}`;

    // If section is exceptionally long (> 1500 chars), split by paragraphs
    if (section.length > 1500) {
      const paragraphs = section.split(/\n\s*\n/);
      let buffer = '';
      for (const para of paragraphs) {
        if ((buffer + '\n\n' + para).length > 1200 && buffer.length > 0) {
          chunks.push({
            content: buffer.trim(),
            metadata: { title: sectionTitle, category, file: fileName }
          });
          buffer = para;
        } else {
          buffer = buffer ? buffer + '\n\n' + para : para;
        }
      }
      if (buffer.trim()) {
        chunks.push({
          content: buffer.trim(),
          metadata: { title: sectionTitle, category, file: fileName }
        });
      }
    } else {
      chunks.push({
        content: section,
        metadata: { title: sectionTitle, category, file: fileName }
      });
    }
  }

  return chunks;
}

/**
 * Index all documents in /backend/knowledge-base/ into MySQL
 */
export async function indexKnowledgeBase() {
  logger.info(`[KnowledgeBase] Starting document indexing from: ${KNOWLEDGE_BASE_DIR}`);

  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    logger.warn(`[KnowledgeBase] Directory not found: ${KNOWLEDGE_BASE_DIR}`);
    return { success: false, message: 'Knowledge base directory not found', indexedFiles: 0, totalChunks: 0 };
  }

  const files = getMarkdownFiles(KNOWLEDGE_BASE_DIR);
  logger.info(`[KnowledgeBase] Found ${files.length} markdown documents to index.`);

  let totalIndexedFiles = 0;
  let totalIndexedChunks = 0;

  for (const filePath of files) {
    try {
      const relPath = path.relative(KNOWLEDGE_BASE_DIR, filePath).replace(/\\/g, '/');
      const category = relPath.includes('/') ? relPath.split('/')[0] : 'general';
      const fileName = path.basename(filePath, '.md');
      const content = fs.readFileSync(filePath, 'utf-8');

      // 1. Upsert document record
      const docRows = await executeQuery(
        `INSERT INTO ai_knowledge_documents (document_name, document_path, category, version, status, indexed_at)
         VALUES (?, ?, ?, '1.0', 'indexed', NOW())
         ON DUPLICATE KEY UPDATE 
           document_name = VALUES(document_name),
           category = VALUES(category),
           status = 'indexed',
           indexed_at = NOW(),
           updated_at = NOW()`,
        [fileName, relPath, category]
      );

      // Get document ID
      let docId = docRows?.insertId;
      if (!docId) {
        const existing = await executeQuery('SELECT id FROM ai_knowledge_documents WHERE document_path = ? LIMIT 1', [relPath]);
        docId = existing[0]?.id;
      }

      if (!docId) continue;

      // 2. Remove existing chunks for this document
      await executeQuery('DELETE FROM ai_knowledge_chunks WHERE document_id = ?', [docId]);

      // 3. Chunk and insert
      const chunks = chunkMarkdown(content, fileName, category);
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx];
        await executeQuery(
          `INSERT INTO ai_knowledge_chunks (document_id, chunk_content, chunk_index, search_metadata)
           VALUES (?, ?, ?, ?)`,
          [docId, chunk.content, idx, JSON.stringify(chunk.metadata)]
        );
        totalIndexedChunks++;
      }

      totalIndexedFiles++;
    } catch (err) {
      logger.error(`[KnowledgeBase] Error indexing file ${filePath}:`, err.message);
    }
  }

  logger.info(`[KnowledgeBase] Indexing complete: ${totalIndexedFiles} files, ${totalIndexedChunks} chunks.`);
  return {
    success: true,
    indexedFiles: totalIndexedFiles,
    totalChunks: totalIndexedChunks,
    indexedAt: new Date()
  };
}

/**
 * Retrieve relevant knowledge chunks based on user query
 * Uses MySQL FULLTEXT search with fallback to token-based LIKE matching
 */
export async function searchKnowledge(query, { limit = 4, category = null } = {}) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const cleanQuery = query
    .replace(/[^\w\s\u0900-\u097F]/gi, ' ')
    .trim()
    .slice(0, 150);

  if (!cleanQuery) return [];

  try {
    let results = [];

    // Attempt MySQL FULLTEXT search
    if (!isUsingFallback()) {
      try {
        let sql = `
          SELECT 
            c.id,
            c.chunk_content,
            c.chunk_index,
            c.search_metadata,
            d.document_name,
            d.document_path,
            d.category,
            MATCH(c.chunk_content) AGAINST(? IN NATURAL LANGUAGE MODE) AS score
          FROM ai_knowledge_chunks c
          JOIN ai_knowledge_documents d ON c.document_id = d.id
          WHERE MATCH(c.chunk_content) AGAINST(? IN NATURAL LANGUAGE MODE)
        `;
        const params = [cleanQuery, cleanQuery];

        if (category) {
          sql += ' AND d.category = ?';
          params.push(category);
        }

        sql += ' ORDER BY score DESC LIMIT ?';
        params.push(Number(limit));

        results = await executeQuery(sql, params);
      } catch (ftErr) {
        logger.warn('[KnowledgeBase] FULLTEXT search failed or not available, falling back to LIKE search:', ftErr.message);
      }
    }

    // Fallback: If FULLTEXT yielded no rows or failed, run keyword / token search
    if (!results || results.length === 0) {
      const keywords = cleanQuery
        .split(/\s+/)
        .map(k => k.trim())
        .filter(k => k.length > 2 && !['what', 'how', 'when', 'where', 'why', 'can', 'the', 'and', 'for', 'kya', 'hai', 'kaise', 'karein', 'mujhe'].includes(k.toLowerCase()))
        .slice(0, 4);

      if (keywords.length > 0) {
        const likeClauses = keywords.map(() => 'c.chunk_content LIKE ?').join(' OR ');
        const likeParams = keywords.map(k => `%${k}%`);

        let sql = `
          SELECT 
            c.id,
            c.chunk_content,
            c.chunk_index,
            c.search_metadata,
            d.document_name,
            d.document_path,
            d.category,
            1.0 AS score
          FROM ai_knowledge_chunks c
          JOIN ai_knowledge_documents d ON c.document_id = d.id
          WHERE (${likeClauses})
        `;
        const params = [...likeParams];
        if (category) {
          sql += ' AND d.category = ?';
          params.push(category);
        }
        sql += ' LIMIT ?';
        params.push(Number(limit));

        results = await executeQuery(sql, params);
      }
    }

    // Format output
    return (results || []).map(row => {
      let metadata = {};
      try {
        metadata = typeof row.search_metadata === 'string' ? JSON.parse(row.search_metadata) : (row.search_metadata || {});
      } catch (_) {}

      return {
        id: row.id,
        content: row.chunk_content,
        documentName: row.document_name,
        documentPath: row.document_path,
        category: row.category,
        title: metadata.title || row.document_name,
        score: row.score || 1.0
      };
    });
  } catch (err) {
    logger.error('[KnowledgeBase] Error during knowledge retrieval:', err.message);
    return [];
  }
}

/**
 * Get current indexing status
 */
export async function getKnowledgeBaseStatus() {
  try {
    const docCount = await executeQuery('SELECT COUNT(*) AS totalDocs FROM ai_knowledge_documents');
    const chunkCount = await executeQuery('SELECT COUNT(*) AS totalChunks FROM ai_knowledge_chunks');
    const lastIndexed = await executeQuery('SELECT MAX(indexed_at) AS lastIndexedAt FROM ai_knowledge_documents');
    const categories = await executeQuery('SELECT category, COUNT(*) as count FROM ai_knowledge_documents GROUP BY category');

    return {
      totalDocuments: docCount[0]?.totalDocs || 0,
      totalChunks: chunkCount[0]?.totalChunks || 0,
      lastIndexedAt: lastIndexed[0]?.lastIndexedAt || null,
      categories: categories || []
    };
  } catch (err) {
    logger.error('[KnowledgeBase] Failed to fetch status:', err.message);
    return {
      totalDocuments: 0,
      totalChunks: 0,
      lastIndexedAt: null,
      categories: []
    };
  }
}

export default {
  indexKnowledgeBase,
  searchKnowledge,
  getKnowledgeBaseStatus
};
