# Luna AI Bestie - Enhanced Memory System Implementation Plan

## Current State Analysis

### Existing Implementation
- **Storage**: SQLite via `better-sqlite3` + JSON fallback file
- **Search**: Simple cosine similarity on vector embeddings
- **Memory Types**: `core`, `fact`, `instruction`, `summary`
- **Metadata**: Basic (id, text, embedding, type, timestamp, date)
- **Database Schema**: Already has `tags`, `importance`, `last_recalled` columns

### Current Limitations
1. Only uses vector similarity (no keyword matching)
2. No importance weighting in search results
3. No recency bias
4. No emotional context matching
5. No memory consolidation/forgetting
6. No context window optimization

---

## Implementation Plan

### Phase 1: Enhanced Database Schema (Priority: HIGH)

**1.1 Add New Columns to Memories Table**
```
sql
-- Add missing columns via migration
ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE memories ADD COLUMN emotional_context TEXT;  -- user's mood when stored
ALTER TABLE memories ADD COLUMN source TEXT;  -- 'conversation', 'photo', 'manual'
ALTER TABLE memories ADD COLUMN expires_at INTEGER;  -- for temporary memories
```

**1.2 Create Indexes for Fast Retrieval**
```
sql
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memories_timestamp ON memories(timestamp DESC);
CREATE INDEX idx_memories_last_recalled ON memories(last_recalled DESC);
```

---

### Phase 2: Enhanced Search Algorithm (Priority: HIGH)

**2.1 Multi-Factor Scoring System**
```
Final Score = (Vector_Score × 0.35) 
            + (Keyword_Score × 0.20) 
            + (Importance × 0.15) 
            + (Recency × 0.15)
            + (Emotional_Match × 0.15)
```

**2.2 Keyword Extraction Helper**
```
javascript
// Simple keyword extraction (can be enhanced with NLP)
const extractKeywords = (text) => {
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or'];
    return text.toLowerCase()
        .split(/\s+/)
        .filter(word => !stopWords.includes(word) && word.length > 2);
};

// Calculate keyword match score
const keywordScore = (query, memoryText) => {
    const queryKeywords = extractKeywords(query);
    const memoryKeywords = extractKeywords(memoryText);
    const matches = queryKeywords.filter(k => memoryKeywords.includes(k));
    return matches.length / Math.max(queryKeywords.length, 1);
};
```

**2.3 Recency Boost Function**
```
javascript
const recencyScore = (timestamp, decayFactor = 0.1) => {
    const daysSince = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    return Math.exp(-decayFactor * daysSince);  // Exponential decay
};
```

**2.4 Enhanced Search Function**
```
javascript
export const enhancedSearch = async (query, options = {}) => {
    const {
        currentMood = 'neutral',
        threshold = 0.5,
        limit = 5,
        types = ['fact', 'instruction', 'summary']
    } = options;
    
    // Get query embedding
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) return [];
    
    // Get keyword score
    const queryKeywords = extractKeywords(query);
    
    // Calculate all scores
    const results = memoryStore
        .filter(m => types.includes(m.type))
        .map(memory => {
            const vectorScore = cosineSimilarity(queryEmbedding, memory.embedding) || 0;
            const kwScore = keywordScore(query, memory.text);
            const importanceScore = (memory.importance || 1) / 10;
            const recencyScoreVal = recencyScore(memory.timestamp);
            const emotionalScore = memory.emotional_context === currentMood ? 1 : 0;
            
            const finalScore = 
                (vectorScore * 0.35) +
                (kwScore * 0.20) +
                (importanceScore * 0.15) +
                (recencyScoreVal * 0.15) +
                (emotionalScore * 0.15);
                
            return { ...memory, score: finalScore };
        })
        .filter(m => m.score > threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    
    // Update access counts
    results.forEach(m => incrementAccess(m.id));
    
    return results;
};
```

---

### Phase 3: Memory Types & Organization (Priority: MEDIUM)

**3.1 Define Memory Types**
```
javascript
const MEMORY_TYPES = {
    CORE: 'core',           // Permanent identity facts (never forget)
    EPISODIC: 'episodic',   // Conversation summaries
    SEMANTIC: 'semantic',   // Learned knowledge
    WORKING: 'working',     // Current context (short-lived)
    FACT: 'fact',           // General facts about user
    INSTRUCTION: 'instruction',  // Custom instructions
    SUMMARY: 'summary'      // Daily/weekly summaries
};
```

**3.2 Priority-Based Storage**
```
javascript
const MEMORY_PRIORITY = {
    CORE: { maxAge: Infinity, maxCount: Infinity, importance: 10 },
    EPISODIC: { maxAge: 90 days, maxCount: 100, importance: 5 },
    SEMANTIC: { maxAge: 180 days, maxCount: 500, importance: 7 },
    FACT: { maxAge: 60 days, maxCount: 200, importance: 5 },
    WORKING: { maxAge: 1 day, maxCount: 10, importance: 3 },
    SUMMARY: { maxAge: 365 days, maxCount: 50, importance: 6 }
};
```

---

### Phase 4: Memory Consolidation (Priority: MEDIUM)

**4.1 Auto-Summarization**
```
javascript
export const consolidateMemories = async () => {
    // Get old episodic memories (older than 7 days)
    const oldMemories = memoryStore
        .filter(m => m.type === 'episodic' && 
                   Date.now() - m.timestamp > 7 * 24 * 60 * 60 * 1000);
    
    if (oldMemories.length < 3) return;  // Need minimum to summarize
    
    // Create summary prompt
    const summaryPrompt = `Summarize these conversation highlights into 2-3 sentences:\n${oldMemories.map(m => m.text).join('\n')}`;
    
    // Generate summary via Ollama
    const summary = await generateResponse([
        { role: 'system', content: 'You are a helpful assistant that creates concise summaries.' },
        { role: 'user', content: summaryPrompt }
    ]);
    
    // Store as summary, remove originals
    addMemory(summary, null, 'summary');
    oldMemories.forEach(m => deleteMemory(m.id));
};
```

**4.2 Forgetting Mechanism**
```
javascript
const FORGETTING_THRESHOLD = {
    LOW_IMPORTANCE: { days: 30, minAccess: 2 },
    MEDIUM_IMPORTANCE: { days: 90, minAccess: 5 },
    HIGH_IMPORTANCE: { days: 365, minAccess: 10 }
};

export const applyForgetting = () => {
    const now = Date.now();
    
    memoryStore = memoryStore.filter(memory => {
        if (memory.type === 'core') return true;  // Never forget
        
        const age = now - memory.timestamp;
        const days = age / (1000 * 60 * 60 * 24);
        const threshold = FORGETTING_THRESHOLD[
            memory.importance >= 7 ? 'HIGH' : 
            memory.importance >= 4 ? 'MEDIUM' : 'LOW'
        ];
        
        // Keep if: recent enough OR accessed enough
        return days < threshold.days || memory.access_count >= threshold.minAccess;
    });
    
    persistMemory();
};
```

---

### Phase 5: Context Window Optimization (Priority: HIGH)

**5.1 Smart Context Injection**
```
javascript
export const getContextPrompt = async (userMessage, maxTokens = 2000) => {
    // Get relevant memories
    const relevantMemories = await enhancedSearch(userMessage, { limit: 5 });
    
    // Get current user profile
    const profile = loadUserProfile();
    
    // Get active instructions
    const instructions = getInstructions();
    
    // Build context
    let context = "## Relevant Memories:\n";
    relevantMemories.forEach(m => {
        context += `- ${m.text}\n`;
    });
    
    context += "\n## User Profile:\n";
    profile.forEach(p => {
        context += `- ${p.key}: ${p.value}\n`;
    });
    
    context += "\n## Instructions:\n";
    instructions.forEach(i => {
        context += `- ${i.text}\n`;
    });
    
    // Truncate if too long
    if (context.length > maxTokens * 4) {
        context = context.substring(0, maxTokens * 4) + "...[truncated]";
    }
    
    return context;
};
```

**5.2 Sliding Window for Conversation History**
```
javascript
const MAX_CONVERSATION_TURNS = 10;

export const getConversationWindow = (allMessages) => {
    // Always keep first message (system) + last N turns
    if (allMessages.length <= MAX_CONVERSATION_TURNS * 2 + 1) {
        return allMessages;
    }
    
    const systemMsg = allMessages[0];
    const recentMsgs = allMessages.slice(-(MAX_CONVERSATION_TURNS * 2));
    
    return [systemMsg, ...recentMsgs];
};
```

---

### Phase 6: Entity Tracking (Priority: LOW)

**6.1 Named Entity Recognition**
```
javascript
export const extractEntities = async (text) => {
    // Use LLM to extract entities
    const prompt = `Extract named entities (people, places, organizations, dates) from this text. Return as JSON array: ${text}`;
    
    const response = await generateResponse([
        { role: 'system', content: 'You extract entities as JSON.' },
        { role: 'user', content: prompt }
    ]);
    
    try {
        return JSON.parse(response);
    } catch {
        return [];
    }
};

export const updateEntity = (entity) => {
    // Save or update entity in database
    saveEntity({
        ...entity,
        last_mentioned: Date.now()
    });
};
```

---

## Implementation Files to Modify

| File | Changes |
|------|---------|
| `database.js` | Add new columns, indexes, migration logic |
| `src/services/memory.js` | Implement enhanced search, consolidation, context optimization |
| `src/services/personality.js` | Integrate enhanced memory retrieval |
| `src/services/ollama.js` | (Already has getEmbedding) |

---

## Testing Checklist

- [ ] Vector similarity search still works
- [ ] Keyword matching improves results
- [ ] Importance weighting affects ranking
- [ ] Recency bias works correctly
- [ ] Emotional context matching functions
- [ ] Memory consolidation creates summaries
- [ ] Forgetting removes old low-value memories
- [ ] Context injection doesn't exceed token limits
- [ ] Performance: search < 500ms

---

## Follow-Up Steps After Implementation

1. **Monitor Performance**: Track search latency
2. **User Feedback**: Ask if memories feel more relevant
3. **Tune Weights**: Adjust scoring based on results
4. **Backup Data**: Before schema changes

---

*Generated: AI Bestie Memory Enhancement Plan*
