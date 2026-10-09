import Meyda from "meyda";

let audioContext = null;
let sourceNode = null;
let meydaAnalyzer = null;
let isAudioReady = false;

// match offline PyTorch training on ASVspoof 2019/2021 and FakeAVCeleb
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 512;
const NUM_MFCC = 20;

// Threshold for detecting sharp sounds ('P', 'B', 'M')
const PLOSIVE_ENERGY_THRESHOLD = 5.0; 

/** Initializes the Web Audio API and the Meyda DSP analyzer.
** @param {MediaStream} mediaStream - The live microphone stream from WebRTC */
export async function initializeAudioExtractor(mediaStream) {
    if (isAudioReady) return;

    try {
        //Force 16kHz sample rate to match offline datasets
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        //Connect the live microphone feed
        sourceNode = audioContext.createMediaStreamSource(mediaStream);

        // Configure Meyda Analyzer
        // We use numberOfMFCCCoefficients natively based on Meyda's API
        meydaAnalyzer = Meyda.createMeydaAnalyzer({
            audioContext: audioContext,
            source: sourceNode,
            bufferSize: BUFFER_SIZE,
            featureExtractors: ["mfcc", "energy"],
            windowingFunction: "hamming",
            numberOfMFCCCoefficients: NUM_MFCC 
        });

        meydaAnalyzer.start();
        isAudioReady = true;
        console.log("[Veri-Human] Audio Extractor initialized successfully at 16kHz.");
    } catch (error) {
        console.error("[Veri-Human] Failed to initialize Audio Extractor:", error);
    }
}

/** Extracts the acoustic footprint from the current audio buffer. Call this inside your requestAnimationFrame loop.
 @returns {Object|null} { mfccArray, energy, isPlosiveSpike, timestamp } */
export function extractAudioFeatures() {
    if (!isAudioReady || !meydaAnalyzer) return null;

    // Pull the latest calculations from Meyda
    const features = meydaAnalyzer.get();
    if (!features || !features.mfcc) return null;

    // Convert the Float32Array to a standard JS Array
    // Because we set numberOfMFCCCoefficients to 20, this is guaranteed to be the right size
    const mfccArray = Array.from(features.mfcc);
    
    // Detect if the current sound represents a plosive spike
    const isPlosiveSpike = features.energy > PLOSIVE_ENERGY_THRESHOLD;

    return {
        mfccArray,
        energy: features.energy,
        isPlosiveSpike,
        timestamp: performance.now()
    };
}

/* Safely stops the DSP analyzer and closes the audio context. Call this when the video call ends to free up browser memory.*/
export function cleanupAudioExtractor() {
    if (meydaAnalyzer) {
        meydaAnalyzer.stop();
        meydaAnalyzer = null;
    }
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }
    if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
        audioContext = null;
    }
    isAudioReady = false;
    console.log("[Veri-Human] Audio Extractor cleaned up and memory freed.");
}