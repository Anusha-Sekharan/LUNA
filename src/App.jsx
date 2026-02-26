import React, { useState, useEffect, useRef } from 'react';
import FloatingWidget from './components/FloatingWidget';
import ChatInterface from './components/ChatInterface';
import { getResponse } from './services/personality';
import { getMood, getVisuals } from './services/emotions'; // Import emotion service

function App() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, sender: 'luna', text: "Hey bestie! What's up? 💖" }
    ]);
    const [mood, setMood] = useState('happy'); // New mood state
    const [isCameraOn, setIsCameraOn] = useState(false); // Start OFF for performance
    const [isLoaded, setIsLoaded] = useState(false); // For transition
    const [healthData, setHealthData] = useState(null);

    useEffect(() => {
        // ... (existing timer)
        const timer = setTimeout(() => {
            setIsCameraOn(true);
            setIsLoaded(true);
            console.log("Enabling Luna's vision...");
        }, 1500);

        // Check mood on startup
        setMood(getMood());

        // --- TIME OF DAY TRIGGERS ---
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) {
            setMessages(prev => [...prev, { id: 'time-msg', sender: 'luna', text: "Good morning bestie! Ready to crush today? ☕✨" }]);
        } else if (hour >= 22 || hour < 4) {
            setMessages(prev => [...prev, { id: 'time-msg', sender: 'luna', text: "Staying up late? Don't forget to rest your eyes! 🌙💖" }]);
        }

        // IPC Listeners
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            // Clipboard Integration
            ipcRenderer.on('system:clipboard-update', async (event, text) => {
                if (text.startsWith('http') || text.length > 50) {
                    try {
                        const { addMemory, MEMORY_TYPES } = await import('./services/memory');
                        addMemory(`[CLIPBOARD]: ${text.substring(0, 100)}`, null, MEMORY_TYPES.FACT, { importance: 4 });
                        console.log("[Clipboard] Context saved to memory.");
                    } catch (e) { }
                }
            });

            // Health Updates
            ipcRenderer.on('system:health-update', async (event, data) => {
                setHealthData(data);

                // Inject critical health issues into memory for Luna to "know"
                if (data.cpu > 85 || data.battery < 15 || data.temp > 85) {
                    try {
                        const { addMemory, MEMORY_TYPES } = await import('./services/memory');
                        let healthNote = `[SYSTEM_HEALTH]: CPU ${data.cpu}%, Batt ${data.battery}%.`;
                        if (data.topApps && data.topApps[0]) healthNote += ` ${data.topApps[0].name} is using ${data.topApps[0].cpu}% CPU.`;
                        addMemory(healthNote, null, MEMORY_TYPES.FACT, { importance: 4 });
                    } catch (e) {
                        // Fallback
                    }
                }
            });

            const handleCheckIn = (event, message) => {
                setMessages(prev => [...prev, { id: Date.now(), sender: 'luna', text: message }]);
                setIsOpen(true); // Auto-open chat
                ipcRenderer.send('resize-window', 'chat'); // Ensure window is resized
            };

            ipcRenderer.on('bestie-checkin', handleCheckIn);

            return () => {
                ipcRenderer.removeListener('bestie-checkin', handleCheckIn);
                clearTimeout(timer);
            };
        }
        return () => clearTimeout(timer);
    }, []);

    const toggleChat = () => {
        const newStatus = !isOpen;
        setIsOpen(newStatus);

        if (newStatus) {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('resize-window', 'chat');
            }
        } else {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('resize-window', 'widget');
            }
        }
    };

    const handleSendMessage = async (text, stats) => {
        const newMsg = { id: Date.now(), sender: 'user', text };
        setMessages(prev => [...prev, newMsg]);

        // Personality response
        const { registerTactileEmotion, updateBond } = await import('./services/emotions');
        if (stats) registerTactileEmotion(stats);

        const response = await getResponse(text);

        // Increase bond slightly for interaction
        updateBond(0.5);

        // --- ASSISTANT ACTION PARSER ---
        // Robust regex to handle non-greedy matches, multiple actions, and missing closing brackets
        const actionMatch = response.match(/\[ACTION:([A-Z_]+)\|(.*?)(?:\](?!\w)|$)/i);

        if (actionMatch) {
            let [fullMatch, actionName, actionArgsStr] = actionMatch;
            let cleanResponse = response.replace(fullMatch, '').replace(/\]$/, '').trim();

            // Handle Llama3.2 Typos for WhatsApp
            if (actionName.includes('WHATS') || actionName.includes('WHATSPAP')) {
                actionName = 'WHATSAPP_SEND';
            }

            // Cleanup trailing braces from bad LLM JSON generation
            if (actionArgsStr.endsWith('}}')) actionArgsStr = actionArgsStr.slice(0, -1);
            if (!actionArgsStr.endsWith('}')) actionArgsStr += '}';

            // Show message immediately
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'luna', text: cleanResponse || 'Working on it... ⚙️' }]);

            try {
                const args = JSON.parse(actionArgsStr);
                const { ipcRenderer } = window.require('electron');

                console.log(`Executing Assistant Action: ${actionName}`, args);

                switch (actionName) {
                    case 'OPEN_APP':
                        ipcRenderer.send('system:open-app', args);
                        break;
                    case 'BROWSE':
                        ipcRenderer.send('system:browse', args);
                        break;
                    case 'LIST_FILES':
                        ipcRenderer.send('system:list-files', args);
                        break;
                    case 'TYPE_TEXT':
                        ipcRenderer.send('system:type-text', args);
                        break;
                    case 'WHATSAPP_SEND':
                        ipcRenderer.send('system:whatsapp-send', args);
                        break;
                    case 'SEND_EMAIL':
                        ipcRenderer.send('system:send-email', args);
                        break;
                    case 'CAPTURE_SCREEN':
                        handleSeeScreen();
                        break;
                    default:
                        console.warn("Unknown helper action:", actionName);
                }

                // Handle Results from Main
                ipcRenderer.once('system:action-result', (ev, result) => {
                    if (result.success) {
                        const msg = result.data ? `Found items: ${result.data.slice(0, 5).join(', ')}...` : (result.message || 'Action complete! ✅');
                        setMessages(prev => [...prev, {
                            id: Date.now() + 3,
                            sender: 'luna',
                            text: msg
                        }]);
                    } else {
                        const errorText = result.error || 'Access denied or system error.';
                        setMessages(prev => [...prev, {
                            id: Date.now() + 3,
                            sender: 'luna',
                            text: `Oops! I couldn't do that. Details: ${errorText} 😵`
                        }]);
                    }
                });

            } catch (e) {
                console.error("Action Parse Fail:", e);
            }
            // Update mood after interaction
            setMood(getMood());
            return;
        }

        // Check for Legacy Actions (Photo)
        if (response.startsWith('ACTION:TAKE_PHOTO|')) {
            const [action, msgText] = response.split('|');
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'luna', text: msgText }]);

            // Trigger Photo Sequence after a delay (to match the 3-2-1 text)
            setTimeout(async () => {
                if (isCameraOn) {
                    // Flash Effect - CSS Animation for robustness
                    const flash = document.createElement('div');
                    flash.style.position = 'fixed';
                    flash.style.top = 0; flash.style.left = 0; flash.style.width = '100vw'; flash.style.height = '100vh';
                    flash.style.background = 'white'; flash.style.zIndex = 9999; flash.style.opacity = 0;
                    flash.style.pointerEvents = 'none'; // Ensure clicks pass through if it gets stuck (safety)
                    document.body.appendChild(flash);

                    // Animate Flash
                    const animation = flash.animate([
                        { opacity: 0 },
                        { opacity: 1, offset: 0.1 },
                        { opacity: 1, offset: 0.2 },
                        { opacity: 0 }
                    ], {
                        duration: 500,
                        easing: 'ease-out'
                    });

                    animation.onfinish = () => flash.remove();

                    // Capture exactly when flash is brightest (approx 100ms in)
                    setTimeout(() => {
                        import('./services/webcam').then(module => {
                            const { takePhoto } = module;
                            console.log("Attempting to take photo...");
                            const dataUrl = takePhoto();

                            if (dataUrl) {
                                console.log("Photo captured successfully. Size:", dataUrl.length);
                                // 1. Save to Disk (Background)
                                if (window.require) {
                                    const { ipcRenderer } = window.require('electron');
                                    console.log("Sending save-photo IPC...");
                                    ipcRenderer.send('save-photo', { dataUrl });
                                } else {
                                    console.error("Electron require not available");
                                    setMessages(prev => [...prev, { id: Date.now(), sender: 'luna', text: "Error: I can't access my hard drive! (IPC missing) 💾" }]);
                                }

                                // 2. Determine Reaction based on CURRENT MOOD (which reflects face detection)
                                let reactionText = "Omg so cute! 💖";
                                if (mood === 'happy') reactionText = "Omg so cute! Love that smile! 💖";
                                else if (mood === 'neutral') reactionText = "Model face! Slay! 💅";
                                else if (mood === 'excited') reactionText = "Yaaas! Energy! 🔥";
                                else if (mood === 'sassy') reactionText = "Ooh, looking fierce! 😉";
                                else if (mood === 'sad') reactionText = "Aww, cheer up bestie! You look great though.";

                                // 3. Show in Chat
                                setTimeout(() => {
                                    setMessages(prev => [...prev, {
                                        id: Date.now() + 2,
                                        sender: 'luna',
                                        text: reactionText,
                                        image: dataUrl // Pass image to chat
                                    }]);
                                }, 800); // Slight delay for "processing" feel
                            } else {
                                console.error("takePhoto returned null");
                                setMessages(prev => [...prev, { id: Date.now() + 2, sender: 'luna', text: "Oops, camera didn't blink! (Video stream issue?) 😵" }]);
                            }
                        }).catch(err => {
                            console.error("Failed to load webcam module or take photo:", err);
                            setMessages(prev => [...prev, { id: Date.now() + 2, sender: 'luna', text: `Error:Camera module failed! Details: ${err.message} 💥` }]);
                        });
                    }, 100);

                } else {
                    setMessages(prev => [...prev, { id: Date.now() + 2, sender: 'luna', text: "Wait, I can't see! Turn my eyes on first! 🙈" }]);
                }
            }, 3000); // 3 seconds delay for "3... 2... 1..."

        } else {
            setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'luna', text: response }]);
        }

        // Update mood after interaction
        setMood(getMood());
    };

    const handleSeeScreen = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            // Initial countdown message
            const thinkingMsgId = Date.now();
            setMessages(prev => [...prev, { id: thinkingMsgId, sender: 'luna', text: "Get ready! I'll look at your MAIN monitor in 3... 👁️" }]);

            // Visual countdown
            setTimeout(() => {
                setMessages(prev => prev.map(m => m.id === thinkingMsgId ? { ...m, text: "2... 📸" } : m));
            }, 1000);
            setTimeout(() => {
                setMessages(prev => prev.map(m => m.id === thinkingMsgId ? { ...m, text: "1... 🌟" } : m));
            }, 2000);

            console.log("[App] Requesting screen focus for Luna...");
            ipcRenderer.send('system:capture-screen');

            ipcRenderer.once('system:action-result', async (ev, result) => {
                if (result.success) {
                    const imagePath = result.data;
                    console.log("[Vision] New screenshot captured at:", imagePath);

                    try {
                        const visionModule = await import('./services/vision');
                        const description = await visionModule.describeImage(imagePath);

                        // Update the thinking message with the real answer and the image
                        setMessages(prev => prev.map(m =>
                            m.id === thinkingMsgId
                                ? { ...m, text: description, image: `media://${imagePath}` }
                                : m
                        ));

                        // Store vision memory
                        const { addMemory, MEMORY_TYPES } = await import('./services/memory');
                        addMemory(`Luna saw screen: ${description}`, null, MEMORY_TYPES.EPISODIC, { importance: 4 });

                    } catch (err) {
                        console.error("Vision Module Error:", err);
                        setMessages(prev => prev.map(m =>
                            m.id === thinkingMsgId
                                ? { ...m, text: "I looked, but it's a bit blurry! Check my connection? 😵" }
                                : m
                        ));
                    }
                } else {
                    console.error("Screen Capture Failed:", result.error);
                    setMessages(prev => prev.map(m =>
                        m.id === thinkingMsgId
                            ? { ...m, text: `Sorry bestie, I couldn't capture your screen! Error: ${result.error || 'Unknown'}` }
                            : m
                    ));
                }
            });
        }
    };

    const handleRunScene = (sceneName) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('system:run-scene', { sceneName });

            // Notification in chat
            const sceneLabel = sceneName.charAt(0).toUpperCase() + sceneName.slice(1);
            setMessages(prev => [...prev, {
                id: Date.now(),
                sender: 'luna',
                text: `Executing ${sceneLabel} Mode! 🪄✨ Give me a sec to set things up...`
            }]);
        }
    };

    // --- WEBCAM INTEGRATION ---
    useEffect(() => {
        let isMounted = true;

        const handleVisualEmotion = (faceMood) => {
            if (!isMounted) return;
            console.log(`Webcam detected: ${faceMood}`);

            // FUSION LOGIC
            import('./services/emotions').then(({ registerVisualEmotion }) => {
                const changed = registerVisualEmotion(faceMood);
                if (changed) {
                    setMood(faceMood);
                }
            });
        };

        let cleanup = () => { };

        if (isCameraOn) {
            import('./services/webcam').then(module => {
                const { startWebcam, stopWebcam } = module;
                startWebcam(handleVisualEmotion);
                cleanup = stopWebcam;
            });
        }

        return () => {
            isMounted = false;
            cleanup();
        };
    }, [isCameraOn]); // Re-run when toggle changes

    const [isMonitoring, setIsMonitoring] = useState(false);
    const monitorIntervalRef = useRef(null);

    // --- CONTINUOUS MONITORING LOGIC ---
    useEffect(() => {
        if (isMonitoring) {
            console.log("[Monitoring] Starting Silent Pulse (60s)...");

            // Initial capture
            silentCapture();

            monitorIntervalRef.current = setInterval(() => {
                silentCapture();
            }, 60000); // 60 seconds
        } else {
            if (monitorIntervalRef.current) {
                console.log("[Monitoring] Stopping Pulse.");
                clearInterval(monitorIntervalRef.current);
            }
        }

        return () => {
            if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
        };
    }, [isMonitoring]);

    const silentCapture = () => {
        if (!window.require) return;
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('system:capture-screen');

        // Handle result silently
        ipcRenderer.once('system:action-result', async (ev, result) => {
            if (result.success) {
                const imagePath = result.data;
                try {
                    const visionModule = await import('./services/vision');
                    const description = await visionModule.describeImage(imagePath, "SOTA ACCURACY: Identify the active window title, prominent text, and user task context. Be specific.");

                    // Store as special Live Context memory
                    const { addMemory, MEMORY_TYPES } = await import('./services/memory');
                    addMemory(`[LIVE_SCREEN_CONTEXT]: ${description}`, null, MEMORY_TYPES.FACT, { importance: 3 });
                    console.log("[Monitoring] Silent capture processed:", description);
                } catch (err) {
                    console.error("[Monitoring] Failed:", err);
                }
            }
        });
    };

    const visuals = getVisuals(mood);

    // --- VIBE-SYNC THEME LOGIC ---
    useEffect(() => {
        const root = document.documentElement;
        const color = visuals.color || 'cyan';
        root.style.setProperty('--vibe-color', color);
        root.style.setProperty('--vibe-bg', `rgba(${mood === 'happy' ? '20, 20, 40' : mood === 'sad' ? '0, 10, 30' : '40, 0, 20'}, 0.85)`);
        root.style.setProperty('--vibe-border', `${color}44`);
        root.style.setProperty('--vibe-glow', `0 10px 30px ${color}33`);
    }, [mood, visuals]);

    return (
        <div className="app-container">
            {isOpen ? (
                <ChatInterface
                    onClose={toggleChat}
                    messages={messages}
                    onSend={handleSendMessage}
                    moodVisuals={visuals}
                    isCameraOn={isCameraOn}
                    onToggleCamera={() => setIsCameraOn(!isCameraOn)}
                    onSeeScreen={handleSeeScreen}
                    isMonitoring={isMonitoring}
                    onToggleMonitoring={() => setIsMonitoring(!isMonitoring)}
                    healthData={healthData}
                    onRunScene={handleRunScene}
                />
            ) : (
                <FloatingWidget
                    onClick={toggleChat}
                    visuals={visuals}
                />
            )}
        </div>
    );
}

export default App;
