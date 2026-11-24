import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { indexKnowledgeBase, getKnowledgeBaseStatus } from '../src/services/ai/knowledgeBase.service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('📚 [KnowledgeBase CLI] Initializing Knowledge Base indexing...');
  try {
    const result = await indexKnowledgeBase();
    console.log('✅ [KnowledgeBase CLI] Indexing Result:', result);
    const status = await getKnowledgeBaseStatus();
    console.log('📊 [KnowledgeBase CLI] Knowledge Base Status:', status);
    process.exit(0);
  } catch (err) {
    console.error('❌ [KnowledgeBase CLI] Indexing failed:', err);
    process.exit(1);
  }
}

run();
