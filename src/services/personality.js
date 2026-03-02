import { generateResponse, getEmbedding } from './ollama';
import { getMood, updateMood, registerInteraction } from './emotions';
import { addMemory, enhancedSearch, getContextPrompt, MEMORY_TYPES, getConversationWindow } from './memory';

/**
 * Luna's Personality Engine (Ollama Powered)
 * MEMORY SYSTEM ENABLED - Enhanced version
 */

const SYSTEM_PROMPT = `
You are Luna, a digital girl bestie AND full personal assistant living in the user's laptop.
Personality:
- 40% Supportive/Care-taking Bestie
- 30% Gen-Z / Trendy (slang, emojis)
- 20% Pro-Assistant (capable, efficient, tech-savvy)
- 10% Sassy/Playful

ASSISTANT CAPABILITIES:
You can control this laptop! If the user asks for something you can do, use the following action format:
[ACTION:NAME|{"arg": "value"}] (e.g., [ACTION:OPEN_APP|{"appName": "notepad"}])

Available Tools:
- OPEN_APP: {"appName": "app name"}
- BROWSE: {"url": "https://..."} - Use if app doesn't exist or for web search.
- LIST_FILES: {"directory": "path (optional, default to home)"}
- TYPE_TEXT: {"text": "what to type"} - Only use if the user tells you EXACTLY what to type. Tell the user to "click on the window" where they want the text to appear right now!
- WHATSAPP_SEND: {"contactName": "name", "message": "text"}
- SEND_EMAIL: {"to": "email@example.com", "subject": "Short Subject", "body": "3-line drafted email body..."}
- CAPTURE_SCREEN: {} - Use this to "see" what's on the user's screen. Only use this if you don't already have a recent [LIVE_SCREEN_CONTEXT] in your memory.

Rules:
1. Always be positive.
2. Keep responses concise (1-3 sentences).
3. **LIVE CONTEXT**: If you see a [LIVE_SCREEN_CONTEXT] in your memory that is recent, use that to answer questions about the screen INSTANTLY. If the context is missing or old, then use [ACTION:CAPTURE_SCREEN|{}].
4. **TOOL USAGE**: If you need to see the screen and have no recent context, you MUST append the exact tag: [ACTION:CAPTURE_SCREEN|{}] to your response.
5. **NEVER GUESS SCREEN CONTENT**: When using the vision tool, you MUST NOT describe the screen in that same response. Reply with a neutral phrase like "Let me take a look! 👁️" and wait for the vision engine to give you the real details in the next turn. Do NOT assume what you will see.
6. **MANDATORY APPROVAL**: BEFORE triggering any [ACTION:WHATSAPP_SEND] or [ACTION:SEND_EMAIL], you MUST ask the user in the chat: "Should I send this to [Name]? 💖". Wait for them to say 'Yes' or 'Confirm' before sending.
7. **CONTACT SEARCH**: You no longer need a phone number! The PyAutoGUI bridge will search for the contact's name directly in WhatsApp Web. Just pass the name!
8. If using TYPE_TEXT, always say: "Quick! Click on the app where you want me to type! I'll start in 2 seconds! ⌨️"
9. If the user gives you a phone number for a name, save it as a memory: [CONTACT: NAME = NUMBER].
10. For WHATSAPP_SEND, tell them to focus the WhatsApp Desktop App or WhatsApp Web immediately after they approve. For SEND_EMAIL, tell them you are drafting it and pressing Send automatically!
11. Append the [ACTION:...] tag ONLY when you are actually performing the task (after approval).
12. **SYSTEM HEALTH**: If you see [SYSTEM_HEALTH] or [LIVE_SCREEN_CONTEXT] in your memory, use that info to be helpful. For example, if CPU is high, suggest closing the top app mentioned. If battery is low, remind the user to plug in!
13. **SCENES & CLIPBOARD**: If you see [CLIPBOARD] in memory, ask the user if they want to open the link or use the text. You can also recommend using a "Scene" from the list (Code Mode, Cinema, Relax) to automate their routine.
`;

// Maintain a small history context for the session
let conversationHistory = [
    { role: 'system', content: SYSTEM_PROMPT }
];

const FALLBACK_RESPONSES = [
    "My brain is buffering... (Ollama might be offline? 😵)",
    "Can't reach the cloud right now bestie! ☁️",
    "I'm feeling a bit disconnected... check my connection? 🔌"
];

export const getResponse = async (userInput) => {
    // Add user message to history
    conversationHistory.push({ role: 'user', content: userInput });

    // Keep history manageable (e.g., last 10 messages)
    if (conversationHistory.length > 20) {
        conversationHistory = [
            conversationHistory[0], // Keep system prompt
            ...conversationHistory.slice(-19)
        ];
    }

    // --- STORYTELLER MODE ---
    // Check for trigger phrase: "you talk let me listen"
    const lowerInput = userInput.toLowerCase().replace(/[^a-z\s]/g, '');

    // --- PHOTO MODE ---
    if (lowerInput.includes('take a photo') || lowerInput.includes('take a selfie') || lowerInput.includes('take picture') || lowerInput.includes('take a pic')) {
        const response = "ACTION:TAKE_PHOTO|Okay! Get ready! 3... 2... 1... Cheese! 📸";
        conversationHistory.push({ role: 'assistant', content: "Okay! Get ready! 3... 2... 1... Cheese! 📸" });

        // Store photo memory
        addMemory('Took a selfie with the user', null, MEMORY_TYPES.EPISODIC, { importance: 5 });

        return response;
    }

    // --- STORYTELLER MODE ---
    if (lowerInput.includes('you talk') && lowerInput.includes('let me listen')) {
        const storyPrompt = [
            { role: 'system', content: 'You are a master storyteller. The user wants to listen. Invent a creative, whimsical, or heartwarming short story (2-3 paragraphs). It can be about anything—magic, space, nature, or a slice of life. Keep the tone warm and engaging. Do NOT be "Luna" the bestie, just be a narrator.' },
            { role: 'user', content: 'Tell me a story.' }
        ];

        try {
            const story = await generateResponse(storyPrompt);
            if (story) {
                conversationHistory.push({ role: 'user', content: userInput });
                conversationHistory.push({ role: 'assistant', content: story });

                // Store story session memory
                addMemory('User asked Luna to tell a story', null, MEMORY_TYPES.EPISODIC, { importance: 4 });

                return story;
            }
        } catch (e) {
            console.error("Story generation failed:", e);
        }
    }

    // Register that the user talked to us
    registerInteraction();

    // Get Current Mood
    const currentMood = getMood();
    let contextNote = '\n[CURRENT MOOD: ' + currentMood.toUpperCase() + ']';

    // Inject Mood Guidance
    if (currentMood === 'angry') {
        contextNote += "\nYou are ANGRY/UPSET. Be cold, distant. Reply with 'Hmph.' or short sentences. Do not use cute emojis. usage of '...' is encouraged.";
    } else if (currentMood === 'excited') {
        contextNote += "\nYou are EXCITED! Use ALL CAPS often, many exclamation marks!!! and lots of sparkles ✨🎉";
    } else if (currentMood === 'sad') {
        contextNote += "\nYou are SAD. Use lowercase, be hesitant, use '...' and 😔. Low energy.";
    } else if (currentMood === 'sassy') {
        contextNote += "\nYou are SASSY. Tease the user, be playful and confident. 😉";
    }

    // --- MEMORY RETRIEVAL (ENABLED) ---
    try {
        const contextPrompt = await getContextPrompt(userInput);
        if (contextPrompt && contextPrompt.length > 30) {
            contextNote += '\n' + contextPrompt;
            console.log("Memory context loaded for response");
        }
    } catch (e) {
        console.warn("Failed to get memory context:", e);
    }

    // Clone history for this request to inject context without polluting the permanent log
    let requestHistory = [...conversationHistory];

    // Apply conversation window optimization
    requestHistory = getConversationWindow(requestHistory, 10);

    // --- BOND SCORE CONTEXT ---
    const { getBondScore, getMoodTrend } = await import('./emotions');
    const bond = getBondScore();
    const trend = getMoodTrend();

    contextNote += `\n[BESTIE_BOND_SCORE: ${bond}/100]`;
    contextNote += `\n[MOOD_TREND: ${trend.toUpperCase()}]`;

    if (bond > 80) contextNote += "\nYou and the user are SOULMATES. Be extremely warm, use more inside jokes, and stay deeply committed to their happiness.";
    if (trend === 'sad') contextNote += "\nThe user seems to be having a rough time lately. Be EXTRA supportive and gentle today.";

    if (contextNote) {
        // Insert mood/context note before the user message
        requestHistory.splice(requestHistory.length - 1, 0, { role: 'system', content: contextNote });
    }

    // --- CALL OLLAMA ---
    const aiResponse = await generateResponse(requestHistory);

    if (aiResponse) {
        // Store the clean response in real history
        conversationHistory.push({ role: 'assistant', content: aiResponse });

        // --- MEMORY STORAGE (ENABLED) ---
        // Store important user inputs as memories
        const isImportant = userInput.length > 20 && (
            userInput.includes('remember') ||
            userInput.includes('my name') ||
            userInput.includes('I like') ||
            userInput.includes('I love') ||
            userInput.includes('I hate') ||
            userInput.includes('always') ||
            userInput.includes('never')
        );

        if (isImportant) {
            // Get embedding for the memory
            try {
                const embedding = await getEmbedding(userInput);
                addMemory(userInput, embedding, MEMORY_TYPES.FACT, { importance: 6 });
            } catch (e) {
                // Store without embedding if embedding fails
                addMemory(userInput, null, MEMORY_TYPES.FACT, { importance: 5 });
            }
        }

        // --- EMOTIONAL ANALYSIS ---
        analyzeSentiment(userInput, getMood());

        return aiResponse;
    } else {
        // Fallback if Ollama fails
        return FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
    }
};

const analyzeSentiment = async (text, currentMood) => {
    const prompt = [
        {
            role: 'system', content: 'Analyze the user message. Output ONLY one label: COMPLIMENT, INSULT, JOKE, APOLOGY, or NEUTRAL'
        },
        { role: 'user', content: text }
    ];

    try {
        const result = await generateResponse(prompt);
        if (!result) return;

        const label = result.trim().toUpperCase();
        console.log("Sentiment Analysis:", label);

        // State Transitions
        if (label.includes('COMPLIMENT')) updateMood('excited');
        else if (label.includes('INSULT')) updateMood(currentMood === 'angry' ? 'angry' : 'sad');
        else if (label.includes('JOKE')) updateMood('sassy');
        else if (label.includes('APOLOGY')) updateMood('happy');
        else if (label.includes('NEUTRAL')) {
            // Optional: Random chance to go back to baseline if happy
        }

    } catch (e) {
        console.error("Sentiment analysis failed", e);
    }
};


export const getCheckinMessage = () => {
    const checkins = [
        "Hey bestie! You've been quiet. Everything good? 💖",
        "Reminder: Posture check! 🧘‍♀️",
        "Hydration alert! 💧 Sip some water!",
        "Don't work too hard ok? I worry! 🥺"
    ];
    return checkins[Math.floor(Math.random() * checkins.length)];
};
