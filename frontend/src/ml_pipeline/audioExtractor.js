import Meyda from "meyda";
let audioContext = null;
const activeAnalyzers = new Map();
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 512;
const NUM_MFCC = 20;
const PLOSIVE_ENERGY_THRESHOLD = 5.0; 

export async function initializeAudioExtractor(socketId, mediaStream) {
    // Toggling cameras/mics can cause WebRTC to generate 
    // a brand NEW MediaStream object. If we already have an analyzer running, 
    // we must check if the stream reference changed.
    if (activeAnalyzers.has(socketId)) {
        const currentAudio = activeAnalyzers.get(socketId);
        // If the stream is exactly the same, do nothing.
        if (currentAudio.stream === mediaStream) {
            return;
        } else {
            // Stream changed! The old stream is dead. Clean it up so we can attach the new one.
            cleanupAudioExtractor(socketId);
        }
    }
    try {
        if (!audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
        }
        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }
        const dummyAudioElement = new Audio();
        dummyAudioElement.srcObject = mediaStream;
        dummyAudioElement.muted = true;
        dummyAudioElement.play().catch(e => console.warn("Dummy audio play failed:", e));
        const sourceNode = audioContext.createMediaStreamSource(mediaStream);
        const dummyGain = audioContext.createGain();
        dummyGain.gain.value = 0;
        sourceNode.connect(dummyGain);
        dummyGain.connect(audioContext.destination);
        const meydaAnalyzer = Meyda.createMeydaAnalyzer({
            audioContext: audioContext,
            source: sourceNode,
            bufferSize: BUFFER_SIZE,
            featureExtractors: ["mfcc", "energy"],
            windowingFunction: "hamming",
            numberOfMFCCCoefficients: NUM_MFCC 
        });
        meydaAnalyzer.start();     
        // Store the mediaStream reference so we can check if it changes later
        activeAnalyzers.set(socketId, { meydaAnalyzer, sourceNode, dummyGain, dummyAudioElement, stream: mediaStream }); 
        console.log(`[Veri-Human] Audio Extractor initialized for ${socketId}`);
    } 
    catch (error) {
        console.error(`[Veri-Human] Audio Extractor failed for ${socketId}:`, error);
    }
}

export function extractAudioFeatures(socketId) {
    const userAudio = activeAnalyzers.get(socketId);
    if (!userAudio || !userAudio.meydaAnalyzer) return null;
    const features = userAudio.meydaAnalyzer.get();
    if (!features || !features.mfcc) return null;
    return {
        mfccArray: Array.from(features.mfcc),
        energy: features.energy,
        isPlosiveSpike: features.energy > PLOSIVE_ENERGY_THRESHOLD,
        timestamp: performance.now()
    };
}

export function cleanupAudioExtractor(socketId = null) {
    if (socketId) {
        const userAudio = activeAnalyzers.get(socketId);
        if (userAudio) {
            userAudio.meydaAnalyzer.stop();
            userAudio.sourceNode.disconnect();
            if (userAudio.dummyGain) userAudio.dummyGain.disconnect();
            if (userAudio.dummyAudioElement) {
                userAudio.dummyAudioElement.pause();
                userAudio.dummyAudioElement.srcObject = null;
            }
            activeAnalyzers.delete(socketId);
        }
    } else {
        activeAnalyzers.forEach(({ meydaAnalyzer, sourceNode, dummyGain, dummyAudioElement }) => {
            meydaAnalyzer.stop();
            sourceNode.disconnect();
            if (dummyGain) dummyGain.disconnect();
            if (dummyAudioElement) {
                dummyAudioElement.pause();
                dummyAudioElement.srcObject = null;
            }
        });
        activeAnalyzers.clear();
        
        if (audioContext && audioContext.state !== "closed") {
            audioContext.close();
            audioContext = null;
        }
    }
}