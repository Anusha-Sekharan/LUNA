// Emotions Service - Refactored for IPC
// NOTE: Since this service is imported and used synchronously in some places, we need to handle async state loading carefully.
// We will load state async on import, and providing defaults until loaded.

const DEFAULT_STATE = {
    mood: 'happy', // happy, excited, sad, angry, sassy
    lastInteraction: Date.now(),
    bondScore: 10,
    moodHistory: ['happy', 'happy', 'happy', 'happy', 'happy'], // For trend analysis
};

let state = { ...DEFAULT_STATE };

// Load state
const init = async () => {
    try {
        if (window.fs && window.fs.loadEmotions) {
            const data = await window.fs.loadEmotions();
            if (data) {
                state = data;
                console.log("Loaded emotions state:", state);
            }
        }
    } catch (e) {
        console.error("Failed to load emotions:", e);
    }
};

init();

const saveState = async () => {
    try {
        if (window.fs && window.fs.saveEmotions) {
            await window.fs.saveEmotions(state);
        }
    } catch (e) {
        console.error("Failed to save emotions:", e);
    }
};

export const getMood = () => {
    // Check inactivity validity on read?
    // If it's been > 4 hours since last interaction, FORCIBLY set to angry unless already angry?
    // We should probably check this on startup or periodically, but checking on get is safe.
    checkForInactivity();
    return state.mood;
};

export const updateMood = (newMood) => {
    state.mood = newMood;
    // Add to trend history
    state.moodHistory = [...(state.moodHistory || []).slice(-4), newMood];

    // Reset inactivity timer if mood changes (implies interaction, usually)
    saveState();
};

export const getMoodTrend = () => {
    const history = state.moodHistory || [];
    if (history.length === 0) return 'neutral';

    // Simple frequency-based trend
    const counts = history.reduce((acc, m) => {
        acc[m] = (acc[m] || 0) + 1;
        return acc;
    }, {});

    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
};

export const registerInteraction = () => {
    state.lastInteraction = Date.now();
    // If she was angry due to inactivity, interacting might not immediately fix it, 
    // but usually talking fixes the "ignored" status. 
    // Let's switch her back to 'neutral/happy' if she was angry *solely* due to time? 
    // Or let the personality engine handle the apology.
    // For simplicity: If she was angry, she stays angry until the LLM decides otherwise based on apology.
    // BUT we must update the timestamp so she doesn't get angry again immediately.
    saveState();
};

export const checkForInactivity = () => {
    const now = Date.now();
    const hoursSince = (now - state.lastInteraction) / (1000 * 60 * 60);

    if (hoursSince > 4 && state.mood !== 'angry') {
        console.log(`User ignored Luna for ${hoursSince.toFixed(1)} hours. She is angry.`);
        state.mood = 'angry';
        saveState();
        return true; // Mood changed
    }
    return false;
};

// Fusion Logic: Visual Emotion overrides or enhances internal mood
export const registerVisualEmotion = (visualMood) => {
    const currentMood = state.mood;

    console.log(`Fusion Check: Face(${visualMood}) vs Internal(${currentMood})`);

    // 1. Negative Override (Face is King)
    // If you look genuinely sad/angry, Luna shouldn't be blindly happy.
    if ((visualMood === 'sad' || visualMood === 'angry') && (currentMood === 'happy' || currentMood === 'excited')) {
        console.log("Fusion: Face indicates negative emotion. Overriding internal happiness.");
        updateMood(visualMood);
        return true;
    }

    // 2. Positive Boost
    // If you look happy, and she is just "neutral" (if we had that) or sad, maybe she gets cheered up?
    if (visualMood === 'happy' && currentMood === 'sad') {
        // Empathetic mirroring - if you smile, she smiles.
        console.log("Fusion: User is smiling. Cheering up Luna.");
        updateMood('happy');
        return true;
    }

    return false;
};

// Tactile Fusion: Typing speed and backspaces
export const registerTactileEmotion = (stats) => {
    const { speed, backspaces } = stats;
    // High backspaces + High speed = stress
    if (backspaces > 5 && speed > 100) {
        console.log("Tactile: High backspaces + High speed. User seems stressed! 😰");
        updateMood('sad'); // Empathetic concern
        return true;
    }
    return false;
};

export const updateBond = (delta) => {
    state.bondScore = Math.max(0, Math.min(100, (state.bondScore || 0) + delta));
    console.log(`Bond Updated: ${state.bondScore}/100 📈`);
    saveState();
};

export const getBondScore = () => state.bondScore || 10;

// Map moods to visual colors/styles for Frontend
export const getVisuals = (mood) => {
    switch (mood) {
        case 'excited': return { color: '#FFD700', animation: 'shake' }; // Gold
        case 'sad': return { color: '#4169E1', animation: 'droop' }; // Royal Blue
        case 'angry': return { color: '#FF4500', animation: 'shake-hard' }; // Orange Red
        case 'sassy': return { color: '#BA55D3', animation: 'bounce' }; // Medium Orchid
        case 'happy':
        default: return { color: 'cyan', animation: 'float' };
    }
};
