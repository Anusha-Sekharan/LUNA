/**
 * Vision Service - Uses moondream model via Ollama
 */

const OLLAMA_GENERATE_ENDPOINT = 'http://localhost:11434/api/generate';
const VISION_MODEL = 'llama3.2-vision';

export const describeImage = async (imagePath, prompt = "Examine this desktop screenshot. IGNORE the small floating chat window on the right. Focus on the main background content. If there is a person, describe their appearance, pose, clothing, and style in detail. If it is an object like a bike or car, describe its specific features. Identify any famous people or specific locations if possible. Be concise but descriptive (2-3 sentences).") => {
    try {
        const fs = window.require('fs');

        if (!fs.existsSync(imagePath)) {
            console.error("[Vision Error] Screenshot not found at:", imagePath);
            return "Wait, I tried to look but my eyes are foggy! (Screenshot file missing). Try clicking the 📸 again? 😵";
        }

        const stats = fs.statSync(imagePath);
        if (stats.size === 0) {
            return "I captured a screenshot, but it's completely blank! 🌑 Check if your target app is minimized?";
        }

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        const response = await fetch(OLLAMA_GENERATE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: VISION_MODEL,
                prompt: prompt,
                images: [base64Image],
                stream: false,
                options: {
                    temperature: 0.2, // Low temperature for more factual description
                    num_predict: 150
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`Vision API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Vision analysis failed:', error);
        return "My vision is a bit blurry right now... check my Ollama connection? 😵";
    }
};
