import { getEmbedding, generateResponse } from './ollama';
import { getMood } from './emotions';

// ============================================
// ENHANCED MEMORY SYSTEM FOR LUNA AI BESTIE
// ============================================

const fs = window.require('fs');
const path = window.require('path');

// Memory file path
const MEMORY_FILE = path.join(process.cwd(), 'data', 'memory.json');

// Ensure directory exists
if (!fs.existsSync(path.dirname(MEMORY_FILE))) {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
}

// ============================================
// MEMORY TYPES DEFINITION
// ============================================
export const MEMORY_TYPES = {
    CORE: 'core',
    EPISODIC: 'episodic',
    SEMANTIC: 'semantic',
    WORKING: 'working',
    FACT: 'fact',
    INSTRUCTION: 'instruction',
    SUMMARY: 'summary'
};

// ============================================
// MEMORY PRIORITY CONFIGURATION
// ============================================
const MEMORY_PRIORITY = {
    [MEMORY_TYPES.CORE]: { maxAge: Infinity, maxCount: Infinity, importance: 10 },
    [MEMORY_TYPES.EPISODIC]: { maxAge: 90 * 24 * 60 * 60 * 1000, maxCount: 100, importance: 5 },
    [MEMORY_TYPES.SEMANTIC]: { maxAge: 180 * 24 * 60 * 60 * 1000, maxCount: 500, importance: 7 },
    [MEMORY_TYPES.FACT]: { maxAge: 60 * 24 * 60 * 60 * 1000, maxCount: 200, importance: 5 },
    [MEMORY_TYPES.WORKING]: { maxAge: 24 * 60 * 60 * 1000, maxCount: 10, importance: 3 },
    [MEMORY_TYPES.INSTRUCTION]: { maxAge: Infinity, maxCount: 50, importance: 9 },
    [MEMORY_TYPES.SUMMARY]: { maxAge: 365 * 24 * 60 * 60 * 1000, maxCount: 50, importance: 6 }
};

// ============================================
// FORGETTING THRESHOLDS
// ============================================
const FORGETTING_THRESHOLD = {
    LOW: { days: 30, minAccess: 2 },
    MEDIUM: { days: 90, minAccess: 5 },
    HIGH: { days: 365, minAccess: 10 }
};

// ============================================
// IN-MEMORY STORE
// ============================================
let memoryStore = [];

// Load memory on start
try {
    if (fs.existsSync(MEMORY_FILE)) {
        const data = fs.readFileSync(MEMORY_FILE, 'utf8');
        memoryStore = JSON.parse(data);
    }
} catch (e) {
    console.error("Failed to load memory:", e);
    memoryStore = [];
}

/**
 * Save the current state of memory to disk
 */
const persistMemory = () => {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memoryStore, null, 2));
    } catch (e) {
        console.error("Failed to save memory:", e);
    }
};

// ============================================
// CORE VECTOR FUNCTIONS
// ============================================

/**
 * Calculate Cosine Similarity between two vectors
 */
const cosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// ============================================
// KEYWORD EXTRACTION (Phase 2)
// ============================================

/**
 * Extract keywords from text for hybrid search
 */
const extractKeywords = (text) => {
    const stopWords = [
        'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
        'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'up', 'about',
        'into', 'through', 'during', 'before', 'after', 'above', 'below',
        'between', 'under', 'again', 'further', 'then', 'once', 'here',
        'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
        'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will',
        'just', 'should', 'now', 'i', 'me', 'my', 'myself', 'we', 'our',
        'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
        'they', 'them', 'their', 'what', 'this', 'that', 'these', 'those'
    ];
    
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => !stopWords.includes(word) && word.length > 2);
};

/**
 * Calculate keyword match score
 */
const keywordScore = (query, memoryText) => {
    const queryKeywords = extractKeywords(query);
    const memoryKeywords = extractKeywords(memoryText);
    
    if (queryKeywords.length === 0 || memoryKeywords.length === 0) return 0;
    
    const matches = queryKeywords.filter(k => memoryKeywords.includes(k));
    return matches.length / Math.max(queryKeywords.length, memoryKeywords.length);
};

// ============================================
// RECENCY SCORING (Phase 2)
// ============================================

/**
 * Calculate recency score with exponential decay
 */
const recencyScore = (timestamp, decayFactor = 0.05) => {
    const daysSince = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    return Math.exp(-decayFactor * daysSince);
};

// ============================================
// EMOTIONAL CONTEXT MATCHING (Phase 2)
// ============================================

/**
 * Calculate emotional context match score
 */
const emotionalScore = (memoryEmotionalContext, currentMood) => {
    if (!memoryEmotionalContext || !currentMood) return 0;
    return memoryEmotionalContext === currentMood ? 1 : 0;
};

// ============================================
// IMPORTANCE WEIGHTING (Phase 2)
// ============================================

/**
 * Normalize importance score to 0-1 range
 */
const importanceScore = (importance) => {
    return Math.min(Math.max((importance || 1) / 10, 0), 1);
};

// ============================================
// MULTI-FACTOR SCORING (Phase 2)
// ============================================

/**
 * Calculate final multi-factor score
 * Weights: Vector 35%, Keywords 20%, Importance 15%, Recency 15%, Emotional 15%
 */
const calculateMultiFactorScore = (memory, queryEmbedding, query, currentMood) => {
    const vectorScore = memory.embedding 
        ? cosineSimilarity(queryEmbedding, memory.embedding) 
        : 0;
    
    const kwScore = keywordScore(query, memory.text);
    const impScore = importanceScore(memory.importance);
    const recScore = recencyScore(memory.timestamp);
    const emoScore = emotionalScore(memory.emotional_context, currentMood);
    
    const finalScore = 
        (vectorScore * 0.35) +
        (kwScore * 0.20) +
        (impScore * 0.15) +
        (recScore * 0.15) +
        (emoScore * 0.15);
    
    return {
        vectorScore,
        keywordScore: kwScore,
        importanceScore: impScore,
        recencyScore: recScore,
        emotionalScore: emoScore,
        finalScore
    };
};

// ============================================
// ENHANCED SEARCH (Phase 2)
// ============================================

/**
 * Enhanced memory search with multi-factor scoring
 */
export const enhancedSearch = async (query, options = {}) => {
    const {
        currentMood = 'neutral',
        threshold = 0.3,
        limit = 5,
        types = [MEMORY_TYPES.FACT, MEMORY_TYPES.INSTRUCTION, MEMORY_TYPES.SUMMARY, MEMORY_TYPES.EPISODIC, MEMORY_TYPES.SEMANTIC]
    } = options;
    
    let queryEmbedding = null;
    try {
        queryEmbedding = await getEmbedding(query);
    } catch (e) {
        console.error("Failed to get query embedding:", e);
    }
    
    if (!queryEmbedding) {
        console.warn("Falling back to keyword-only search");
        return memoryStore
            .filter(m => types.includes(m.type))
            .map(m => ({
                ...m,
                score: keywordScore(query, m.text)
            }))
            .filter(m => m.score > threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    
    const results = memoryStore
        .filter(m => types.includes(m.type))
        .filter(m => !m.expires_at || m.expires_at > Date.now())
        .map(memory => {
            const scores = calculateMultiFactorScore(memory, queryEmbedding, query, currentMood);
            return {
                ...memory,
                ...scores,
                score: scores.finalScore
            };
        })
        .filter(m => m.score > threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    
    results.forEach(m => incrementAccess(m.id));
    
    return results;
};

/**
 * Increment access count for a memory
 */
const incrementAccess = (id) => {
    const memory = memoryStore.find(m => m.id === id);
    if (memory) {
        memory.access_count = (memory.access_count || 0) + 1;
        memory.last_recalled = Date.now();
        persistMemory();
    }
};

// ============================================
// ORIGINAL SEARCH (Legacy support)
// ============================================

/**
 * Search for relevant memories (original simple version)
 */
export const searchMemory = (queryEmbedding, threshold = 0.7, limit = 3) => {
    if (!queryEmbedding) return [];

    const scored = memoryStore.map(mem => ({
        ...mem,
        score: cosineSimilarity(queryEmbedding, mem.embedding)
    }));

    return scored
        .filter(mem => mem.score > threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
};

// ============================================
// ADD MEMORY (Enhanced)
// ============================================

/**
 * Add a new memory entry with full metadata
 */
export const addMemory = (text, embedding, type = MEMORY_TYPES.FACT, options = {}) => {
    const {
        importance = MEMORY_PRIORITY[type] ? MEMORY_PRIORITY[type].importance : 5,
        tags = [],
        emotionalContext = null,
        source = 'conversation',
        expiresAt = null
    } = options;
    
    enforceMemoryLimits(type);
    
    const memory = {
        id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        text: text,
        embedding: embedding,
        type: type,
        tags: tags,
        importance: importance,
        emotional_context: emotionalContext,
        source: source,
        expires_at: expiresAt,
        access_count: 0,
        last_recalled: null,
        timestamp: Date.now(),
        date: new Date().toISOString().split('T')[0]
    };
    
    memoryStore.push(memory);
    persistMemory();
    console.log('Memory saved [' + type + ']:', text.substring(0, 50) + '...');
    
    return memory;
};

// ============================================
// MEMORY LIMITS ENFORCEMENT (Phase 3)
// ============================================

/**
 * Enforce memory type limits
 */
const enforceMemoryLimits = (type) => {
    const config = MEMORY_PRIORITY[type];
    if (!config || config.maxCount === Infinity) return;
    
    const typeMemories = memoryStore
        .filter(m => m.type === type)
        .sort((a, b) => b.timestamp - a.timestamp);
    
    if (typeMemories.length >= config.maxCount) {
        const toRemove = typeMemories.slice(config.maxCount - 1);
        toRemove.forEach(m => {
            memoryStore = memoryStore.filter(mem => mem.id !== m.id);
        });
        console.log('Memory limit reached for type ' + type + ', removed ' + toRemove.length + ' old memories');
    }
};

// ============================================
// MEMORY CONSOLIDATION (Phase 4)
// ============================================

/**
 * Consolidate old episodic memories into summaries
 */
export const consolidateMemories = async () => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const oldMemories = memoryStore
        .filter(m => m.type === MEMORY_TYPES.EPISODIC && m.timestamp < sevenDaysAgo);
    
    if (oldMemories.length < 3) {
        console.log("Not enough old memories to consolidate");
        return;
    }
    
    const summaryPrompt = 'Summarize these conversation highlights into 2-3 sentences that capture the key themes and user preferences:\n\n' + oldMemories.map(m => m.text).join('\n\n');
    
    try {
        const summary = await generateResponse([
            { role: 'system', content: 'You are a helpful assistant that creates concise, warm summaries of conversations.' },
            { role: 'user', content: summaryPrompt }
        ]);
        
        if (summary) {
            addMemory(summary, null, MEMORY_TYPES.SUMMARY, { importance: 6 });
            
            oldMemories.forEach(m => {
                memoryStore = memoryStore.filter(mem => mem.id !== m.id);
            });
            
            persistMemory();
            console.log("Memory consolidation complete");
        }
    } catch (e) {
        console.error("Memory consolidation failed:", e);
    }
};

// ============================================
// FORGETTING MECHANISM (Phase 4)
// ============================================

/**
 * Apply forgetting to remove old low-value memories
 */
export const applyForgetting = () => {
    const now = Date.now();
    const originalCount = memoryStore.length;
    
    memoryStore = memoryStore.filter(memory => {
        if (memory.type === MEMORY_TYPES.CORE) return true;
        if (memory.type === MEMORY_TYPES.INSTRUCTION) return true;
        
        const age = now - memory.timestamp;
        const days = age / (1000 * 60 * 60 * 24);
        
        let threshold;
        if (memory.importance >= 7) threshold = FORGETTING_THRESHOLD.HIGH;
        else if (memory.importance >= 4) threshold = FORGETTING_THRESHOLD.MEDIUM;
        else threshold = FORGETTING_THRESHOLD.LOW;
        
        return days < threshold.days || (memory.access_count || 0) >= threshold.minAccess;
    });
    
    const removed = originalCount - memoryStore.length;
    if (removed > 0) {
        persistMemory();
        console.log('Forgetting applied: removed ' + removed + ' memories');
    }
};

// ============================================
// CONTEXT WINDOW OPTIMIZATION (Phase 5)
// ============================================

/**
 * Get smart context prompt for LLM
 */
export const getContextPrompt = async (userMessage, maxTokens = 2000) => {
    const currentMood = getMood();
    
    const relevantMemories = await enhancedSearch(userMessage, {
        currentMood: currentMood,
        limit: 5,
        threshold: 0.3
    });
    
    let context = "## Relevant Memories:\n";
    if (relevantMemories.length > 0) {
        relevantMemories.forEach(m => {
            context += '- [' + m.type + '] ' + m.text + '\n';
        });
    } else {
        context += "- No relevant memories found.\n";
    }
    
    const estimatedTokens = context.length / 4;
    
    if (estimatedTokens > maxTokens) {
        context = context.substring(0, maxTokens * 4) + "...[memories truncated]";
    }
    
    return context;
};

/**
 * Get conversation window with sliding mechanism
 */
export const getConversationWindow = (allMessages, maxTurns = 10) => {
    const systemMsg = allMessages.find(m => m.role === 'system');
    
    const conversationMsgs = allMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    
    if (conversationMsgs.length <= maxTurns * 2) {
        return systemMsg ? [systemMsg, ...conversationMsgs] : conversationMsgs;
    }
    
    const recentMsgs = conversationMsgs.slice(-(maxTurns * 2));
    
    return systemMsg ? [systemMsg, ...recentMsgs] : recentMsgs;
};

// ============================================
// ENTITY TRACKING (Phase 6)
// ============================================

/**
 * Extract named entities from text using LLM
 * Returns array of {name, type} objects
 */
export const extractEntities = async (text) => {
    const prompt = 'Extract named entities from this text. Return ONLY valid JSON array like: [{"name":"John","type":"person"}]';
    
    try {
        const response = await generateResponse([
            { role: 'system', content: 'You extract entities as JSON arrays. Return ONLY valid JSON, no explanations.' },
            { role: 'user', content: prompt + ' Text: ' + text }
        ]);
        
        // Simple string cleanup - remove any surrounding text
        let cleaned = response.trim();
        
        // Find the first [ and last ] to extract JSON array
        const startIdx = cleaned.indexOf('[');
        const endIdx = cleaned.lastIndexOf(']');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
        }
        
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("Entity extraction failed:", e);
        return [];
    }
};

/**
 * Update entity in database
 */
export const updateEntity = (entity) => {
    console.log("Entity update requested:", entity);
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getMemories = () => {
    return memoryStore;
};

export const getMemoriesByType = (type) => {
    return memoryStore.filter(m => m.type === type);
};

export const deleteMemory = (id) => {
    memoryStore = memoryStore.filter(m => m.id !== id);
    persistMemory();
};

export const clearMemories = (keepCore = true) => {
    if (keepCore) {
        memoryStore = memoryStore.filter(m => m.type === MEMORY_TYPES.CORE);
    } else {
        memoryStore = [];
    }
    persistMemory();
};

/**
 * Summarize session and store
 */
export const summarizeSession = async (conversationText) => {
    if (!conversationText) return;
    
    const prompt = 'Create a brief, warm summary (1-2 sentences) of this conversation that captures key topics and user mood:\n\n' + conversationText;
    
    try {
        const summary = await generateResponse([
            { role: 'system', content: 'You create concise, friendly conversation summaries.' },
            { role: 'user', content: prompt }
        ]);
        
        if (summary) {
            addMemory(summary, null, MEMORY_TYPES.SUMMARY, { importance: 6 });
        }
    } catch (e) {
        console.error("Session summarization failed:", e);
    }
};

export const getInstructions = () => {
    return memoryStore.filter(m => m.type === MEMORY_TYPES.INSTRUCTION);
};

export const getMemoryCount = () => memoryStore.length;

export const getMemoryStats = () => {
    const stats = {};
    Object.values(MEMORY_TYPES).forEach(type => {
        stats[type] = memoryStore.filter(m => m.type === type).length;
    });
    return stats;
};

// ============================================
// AUTO-CLEANUP SCHEDULER
// ============================================

setInterval(() => {
    console.log("Running scheduled memory forgetting...");
    applyForgetting();
}, 6 * 60 * 60 * 1000);

setInterval(() => {
    console.log("Running scheduled memory consolidation...");
    consolidateMemories();
}, 24 * 60 * 60 * 1000);

// Default memories (core)
const DEFAULT_MEMORIES = [
    { 
        text: "My name is Luna, your digital AI bestie.", 
        type: MEMORY_TYPES.CORE, 
        id: "core_1",
        importance: 10
    },
    { 
        text: "I live in the user's computer and I love it here.", 
        type: MEMORY_TYPES.CORE, 
        id: "core_2",
        importance: 10
    },
    { 
        text: "I love using emojis and being supportive!", 
        type: MEMORY_TYPES.CORE, 
        id: "core_3",
        importance: 10
    },
    { 
        text: "User is my best friend.", 
        type: MEMORY_TYPES.CORE, 
        id: "core_4",
        importance: 10
    }
];

// Initialize default memories if empty
if (memoryStore.length === 0) {
    DEFAULT_MEMORIES.forEach(m => {
        memoryStore.push({
            text: m.text,
            type: m.type,
            id: m.id,
            importance: m.importance,
            embedding: null,
            tags: [],
            access_count: 0,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0]
        });
    });
    persistMemory();
}
