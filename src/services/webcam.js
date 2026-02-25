
// import * as faceapi from 'face-api.js'; // REMOVED static import
let faceapi; // Dynamic load

let video;
let canvas;
let detectionInterval;
let isModelsLoaded = false;
let currentEmotion = 'neutral';

// Emotion Mapping
const emotionMap = {
    neutral: 'neutral',
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    fearful: 'anxious',
    disgusted: 'angry',
    surprised: 'excited'
};

export const loadModels = async () => {
    if (isModelsLoaded && faceapi) return;
    try {
        console.log("Loading face-api.js with environment masking...");

        // MASK NODE ENVIRONMENT to force Browser Mode
        // This prevents face-api.js from trying to use 'fs' and 'util'
        const _require = window.require;
        const _process = window.process;
        const _global = window.global;

        window.require = undefined;
        window.process = undefined;
        // window.global = undefined; // Might break other things, check if needed

        try {
            // Dynamic Import
            faceapi = await import('face-api.js');
            console.log("face-api.js loaded successfully");
        } finally {
            // Restore Environment
            window.require = _require;
            window.process = _process;
            // window.global = _global;
        }

        const MODEL_URL = '/models';
        if (faceapi) {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
            isModelsLoaded = true;
            console.log("FaceAPI Models Loaded");
        }
    } catch (e) {
        console.error("Failed to load FaceAPI models or library", e);
        throw e; // Propagate error
    }
};

export const startWebcam = async (onEmotionChange) => {
    if (!isModelsLoaded) await loadModels();

    // Create hidden video element
    video = document.createElement('video');
    video.width = 320;
    video.height = 240;
    video.autoplay = true;
    video.muted = true; // Avoid audio feedback

    // Request Camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;

        // Wait for video to be ready
        video.addEventListener('play', () => {
            // Start Loop
            detectionInterval = setInterval(async () => {
                if (!video || traceIsPaused) return;

                const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceExpressions();

                if (detections) {
                    processEmotion(detections.expressions, onEmotionChange);
                }
            }, 2000); // Check every 2 seconds
        });

    } catch (err) {
        console.error("Webcam access denied or failed", err);
    }
};

let traceIsPaused = false;

export const stopWebcam = () => {
    if (detectionInterval) clearInterval(detectionInterval);
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    video = null;
};

const processEmotion = (expressions, callback) => {
    // Find dominant emotion
    let max = 0;
    let dominant = 'neutral';

    for (const [emotion, value] of Object.entries(expressions)) {
        if (value > max) {
            max = value;
            dominant = emotion;
        }
    }

    // Confidence Threshold
    if (max < 0.5) return; // Not sure

    const lunaMood = emotionMap[dominant] || 'neutral';

    // Debounce: Only update if changed (or force update periodically?)
    if (lunaMood !== currentEmotion) {
        currentEmotion = lunaMood;
        console.log(`Face: ${dominant} (${(max * 100).toFixed(0)}%) -> Luna: ${lunaMood}`);
        callback(lunaMood);
    }
};

export const takePhoto = () => {
    if (!video) {
        console.error("Webcam: Video element is null");
        return null;
    }
    if (video.readyState !== 4) {
        console.error("Webcam: Video not ready. ReadyState:", video.readyState);
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Flip horizontally if the webcam is mirrored (usually it is for user view)
    // But face-api detects on raw video. Let's just draw it.
    // If we want mirroring:
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/png');
};

