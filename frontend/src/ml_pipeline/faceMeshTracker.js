import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
let faceLandmarker = null;
let isTrackerReady = false;

let config = {
    numFaces: 5,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
};

// MediaPipe 3D Landmark Indices for eyes and outer lips
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const OUTER_LIP = [61, 37, 267, 291, 314, 17];

/* Initializes the MediaPipe Face Landmarker */
export async function initializeFaceTracker(customConfig = {}) {
    if (isTrackerReady) return;
    Object.assign(config, customConfig);
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );      
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
            runningMode: "VIDEO",
            numFaces: config.numFaces,
            minFaceDetectionConfidence: config.minFaceDetectionConfidence,
            minFacePresenceConfidence: config.minFacePresenceConfidence,
            minTrackingConfidence: config.minTrackingConfidence,
        });
        isTrackerReady = true;
        console.log("[Veri-Human] FaceLandmarker initialized.");
    } catch (error) {
        console.error("[Veri-Human] FaceLandmarker Error:", error);
    }
}
/*Computes the Euclidean distance between two 3D coordinates*/
function calculateDistance(point1, point2) {
    return Math.sqrt(
        Math.pow(point1.x - point2.x, 2) +
        Math.pow(point1.y - point2.y, 2) +
        Math.pow(point1.z - point2.z, 2)
    );
}
/* Computes the aspect ratio (EAR/MAR) for a specific facial feature */
function getAspectRatio(landmarks, indices) {
    const p1 = landmarks[indices[0]];
    const p2 = landmarks[indices[1]];
    const p3 = landmarks[indices[2]];
    const p4 = landmarks[indices[3]];
    const p5 = landmarks[indices[4]];
    const p6 = landmarks[indices[5]];
    const vertical1 = calculateDistance(p2, p6);
    const vertical2 = calculateDistance(p3, p5);
    const horizontal = calculateDistance(p1, p4);
    return (vertical1 + vertical2) / (2.0 * horizontal);
}
/** Extracts biometrics and crops the face for the ML Model.
 * @param {HTMLVideoElement} videoElement - The live webcam feed
 * @param {HTMLCanvasElement} cropCanvasElement - The hidden 224x224 canvas for extraction
*/
export function extractFacialFeatures(videoElement, cropCanvasElement) {
    if (!isTrackerReady || !videoElement || videoElement.readyState < 2) return null;
    const timestamp = performance.now();
    const results = faceLandmarker.detectForVideo(videoElement, timestamp);
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        return results.faceLandmarks.map((landmarks, index) => {
            // Calculate EAR (Liveness) and MAR (Lip-sync) 
            const leftEAR = getAspectRatio(landmarks, LEFT_EYE);
            const rightEAR = getAspectRatio(landmarks, RIGHT_EYE);
            const ear = (leftEAR + rightEAR) / 2.0;
            const mar = getAspectRatio(landmarks, OUTER_LIP);
            // Crop Face using HTML5 Canvas API
            const cropCtx = cropCanvasElement.getContext("2d", { willReadFrequently: true });
            const xValues = landmarks.map(l => l.x);
            const yValues = landmarks.map(l => l.y);
            // Convert normalized coordinates (0-1) to actual video pixels
            const minX = Math.min(...xValues) * videoElement.videoWidth;
            const maxX = Math.max(...xValues) * videoElement.videoWidth;
            const minY = Math.min(...yValues) * videoElement.videoHeight;
            const maxY = Math.max(...yValues) * videoElement.videoHeight;
            const width = maxX - minX;
            const height = maxY - minY;
            const paddingX = width * 0.2;
            const paddingY = height * 0.2;
            const cropX = Math.max(0, minX - paddingX);
            const cropY = Math.max(0, minY - paddingY);
            const cropW = Math.min(videoElement.videoWidth - cropX, width + (paddingX * 2));
            const cropH = Math.min(videoElement.videoHeight - cropY, height + (paddingY * 2));
            // Format to 224x224 for neural network standard inputs
            cropCanvasElement.width = 224;
            cropCanvasElement.height = 224;
            cropCtx.clearRect(0, 0, 224, 224);  
            cropCtx.drawImage(
                videoElement,
                cropX, cropY, cropW, cropH, 
                0, 0, 224, 224              
            );
            const faceImageData = cropCtx.getImageData(0, 0, 224, 224);
            return { faceIndex: index, ear, mar, faceCrop: faceImageData, timestamp };
        });
    }
    return null;
}
/* Safely closes the model to free browser GPU memory */
export function cleanupFaceLandmarker() {
    if (faceLandmarker) {
        faceLandmarker.close();
        faceLandmarker = null;
    }
    isTrackerReady = false;
    console.log("[Veri-Human] FaceLandmarker cleaned up and memory freed.");
}