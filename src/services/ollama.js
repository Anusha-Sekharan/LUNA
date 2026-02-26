/**
 * Service to interact with local Ollama instance
 */

const OLLAMA_ENDPOINT = 'http://localhost:11434/api/chat';
const MODEL = 'llama3.2:3b';

export const generateResponse = async (messages) => {
    try {
        const response = await fetch(OLLAMA_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                stream: false, // For simplicity in this MVP
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.message.content;
    } catch (error) {
        console.error('Failed to get response from Ollama:', error);
        return null; // Return null to let the caller handle the fallback
    }
};

export const getEmbedding = async (prompt) => {
    try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL,
                prompt: prompt
            })
        });

        if (!response.ok) throw new Error('Ollama Embedding Failed');

        const data = await response.json();
        return data.embedding;
    } catch (error) {
        console.error('Embedding error:', error);
        return null;
    }
};
