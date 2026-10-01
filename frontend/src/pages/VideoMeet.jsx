import React, { useEffect,useRef,useState } from 'react';
import io from "socket.io-client";
import SendIcon from '@mui/icons-material/Send';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { Badge, IconButton, TextField, InputAdornment } from '@mui/material'; 
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import { useNavigate } from 'react-router-dom';
import server from '../environment';
//Veri-Human ML Pipeline Imports 
import { initializeFaceTracker, extractFacialFeatures, cleanupFaceLandmarker } from '../ml_pipeline/faceMeshTracker';
import { initializeAudioExtractor, extractAudioFeatures, cleanupAudioExtractor } from '../ml_pipeline/audioExtractor';
const server_url = server;
var connections = {};
const peerConfigConnections = {
    "iceServers": [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
            urls: "turn:global.relay.metered.ca:80",
            username: process.env.REACT_APP_TURN_USERNAME,
            credential: process.env.REACT_APP_TURN_CREDENTIAL,
        },
        {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: process.env.REACT_APP_TURN_USERNAME,
            credential: "process.env.REACT_APP_TURN_CREDENTIAL",
        },
        {
            urls: "turn:global.relay.metered.ca:443",
            username: process.env.REACT_APP_TURN_USERNAME,
            credential: process.env.REACT_APP_TURN_CREDENTIAL,
        },
        {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: process.env.REACT_APP_TURN_USERNAME,
            credential: process.env.REACT_APP_TURN_CREDENTIAL,
        },
    ],
}
const getAvatarColor = (name) => {
    const darkColors = ['#5c2b29', '#2e4934', '#334863', '#4d3b5b', '#624128', '#2b5a5b', '#4a4a4a'];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return darkColors[Math.abs(hash) % darkColors.length];
};
const getInitial = (name) => {
    return (name && typeof name === 'string') ? name.charAt(0).toUpperCase() : '?';
};
export default function VideoMeetComponent(){
    // We will handle WebRTC connections state
    var socketRef = useRef();
    let socketIdRef = useRef();
    //localVideoRef initialize with nothing
    let localVideoRef = useRef();
    // Veri-Human ML Refs
    // useRef is used here so we can interact with the canvas and animation loop 
    // without triggering React component re-renders every millisecond.
    let hiddenCanvasRef = useRef(null);
    let animationFrameRef = useRef(null);
    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState(false);
    let [audio, setAudio] = useState(false);
    let [screen, setScreen] = useState(false);
    let [showModal, setModal] = useState();
    let [screenAvailable, setScreenAvailable]= useState();
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    //for guest user
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    const videoRef = useRef([]);
    let [videos, setVideos] = useState([]);
    const meetingWrapperRef = useRef(null);
    let currentVideoState = useRef(video);
    let currentAudioState = useRef(audio);
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => { currentVideoState.current = video; }, [video]);
    useEffect(() => { currentAudioState.current = audio; }, [audio]);
    const router = useNavigate();
    useEffect(()=>{
        getPermissions();
        // Pre-initialize face tracker when component mounts
        initializeFaceTracker();
    }, [])

    useEffect(() => {
        if (socketRef.current) {
            socketRef.current.on("media-status-change", (data) => {
                setVideos(prev => prev.map(v => {
                    if (v.socketId === data.socketId) {
                        if (data.trackType === 'screen') return { ...v, isScreen: data.enabled };
                        return { ...v, [data.trackType === 'video' ? 'videoEnabled' : 'audioEnabled']: data.enabled };
                    }
                    return v;

                }));

            });

        }

    }, [socketRef.current]);
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    const getMeetingTime = () => {
        return currentTime.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
        });
    };
    const getMeetingCode = () => {
        const pathParts = window.location.pathname.split('/');
        return pathParts[pathParts.length - 1] || "21"; 
    };
    const getFormattedDate = () => {
        const date = new Date();
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'long' });

        // Logic for st, nd, rd, th
        const getOrdinalSuffix = (i) => {
            let j = i % 10, k = i % 100;
            if (j === 1 && k !== 11) return i + "st";
            if (j === 2 && k !== 12) return i + "nd";
            if (j === 3 && k !== 13) return i + "rd";
            return i + "th";
        };

        return `${getOrdinalSuffix(day)} ${month}`;
    };
    let getDisplayMedia = ()=>{
        if(screen){
            if(navigator.mediaDevices.getDisplayMedia){
                navigator.mediaDevices.getDisplayMedia({video: true, audio: true})
                .then(getDisplayMediaSuccess)
                .then((stream)=>{})
                .catch((e)=> console.log(e))
            }
        }
    }

    const getPermissions = async() => {
        try {
            //take permission if we can use your camera or not (navigator is important)
            const videoPermission = await navigator.mediaDevices.getUserMedia({video: true});
            // if give permission
            if(videoPermission){
                setVideoAvailable(true);
            }
            else{
                setVideoAvailable(false);
            }
            // writting same things for audio
            const audioPermission = await navigator.mediaDevices.getUserMedia({audio: true});
            // if give permission
            if(audioPermission){
                setAudioAvailable(true);
            }
            else{
                setAudioAvailable(false);
            }
            // to on the screen sharing
            // to show screen we don't need permission
            if(navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            }
            else{
                setScreenAvailable(false);
            }
            if(videoAvailable || audioAvailable){
                // these stream send to client using WEBRTC and also accept stream
                const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});
                //if we have media stream
                if(userMediaStream){
                    window.localStream = userMediaStream;
                    if(localVideoRef.current) {
                        // stream initialize in the video source object
                        localVideoRef.current.srcObject = userMediaStream;
                    }
                }
            }

        }catch(err) {
            console.log(err)
        }
    }

    useEffect(() => {
        // Only execute if we are in the meeting area and the ref is available
        if (!askForUsername && localVideoRef.current) {
            if (window.localStream) {
            localVideoRef.current.srcObject = window.localStream;
            // Force play in case the browser blocked auto-play
            localVideoRef.current.play().catch(e => console.log("Play failed:", e));
            }
        }
    }, [askForUsername]); // Triggers when i switch from lobby to meeting
    // ML Feature Extraction Loop
    const startMLPipeline = () => {
        let frameCount = 0;
        console.log("[Veri-Human] ML Pipeline Loop Started.");

        const processFrame = async () => {
            if (window.localStream) {
                // Read the live UI toggle states using the refs you already created!
                const isVideoActive = currentVideoState.current;
                const isAudioActive = currentAudioState.current;

                // IF BOTH ARE OFF: Send nothing and skip math to save CPU
                if (!isVideoActive && !isAudioActive) {
                    animationFrameRef.current = requestAnimationFrame(processFrame);
                    return; 
                }

                let visualDataArray = null;
                let audioData = null;

                // Try to extract visual data (ONLY if video is active)
                if (isVideoActive && localVideoRef.current && hiddenCanvasRef.current && localVideoRef.current.readyState >= 2 && !localVideoRef.current.paused) {
                    visualDataArray = extractFacialFeatures(localVideoRef.current, hiddenCanvasRef.current);
                }

                // Try to extract audio data (ONLY if audio is active)
                if (isAudioActive) {
                    audioData = extractAudioFeatures();
                }

                // Process whatever data we successfully extracted
                if (visualDataArray || audioData) {
                    frameCount++;
                    
                    if (frameCount % 15 === 0) {
                        // Case A: Video is ON and Faces are detected
                        if (isVideoActive && Array.isArray(visualDataArray) && visualDataArray.length > 0) {
                            visualDataArray.forEach(face => {
                                console.log(`[Veri-Human ML Pipeline - Face ${face.faceIndex}]`, {
                                    ear_liveness: face.ear.toFixed(3),
                                    mar_lipsync: face.mar.toFixed(3),
                                    plosive_spike: audioData ? audioData.isPlosiveSpike : false,
                                    mfcc_0: audioData && audioData.mfccArray ? audioData.mfccArray[0]?.toFixed(2) : "No Audio",
                                    timestamp: performance.now()
                                });
                            });
                        } 
                        // Video is OFF, but Audio is ON
                        else if (isAudioActive && audioData) {
                            console.log(`[Veri-Human ML Pipeline - Audio Only]`, {
                                ear_liveness: "Camera Off",
                                mar_lipsync: "Camera Off",
                                plosive_spike: audioData.isPlosiveSpike,
                                mfcc_0: audioData.mfccArray ? audioData.mfccArray[0]?.toFixed(2) : "No Audio",
                                timestamp: performance.now()
                            });
                        }
                    }

                    // Lip-sync Desync Warning (Only runs if both audio and video are active)
                    if (audioData?.isPlosiveSpike && Array.isArray(visualDataArray)) {
                        visualDataArray.forEach(face => {
                            if (face.mar > 0.15) {
                                console.warn(`[Veri-Human Alert - Face ${face.faceIndex}] Lip-sync Desync: Plosive detected but mouth is open! MAR: ${face.mar.toFixed(3)}`);
                            }
                        });
                    }
                }
            }
            // Recursively call the loop for the next frame
            animationFrameRef.current = requestAnimationFrame(processFrame);
        };

        processFrame();
    };
    /*useEffect(()=>{
        if(video !== undefined && audio !== undefined){
            getUserMedia();
        }
    }, [video, audio]) */

    let getMedia = async()=>{
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        // after run previous two line do getAudio function should be run
        // setVideo, setAudio asynchronous function thats why need dependency use-effect
        connectToSocketServer();
    }
    // This function is responsible for if I stopped my video then all other computers in the meeting my video should be stopped
    let getUserMediaSuccess = (stream)=>{ 
        // Attach to video element if it exists
        try {
            if (window.localStream) {
                window.localStream.getTracks().forEach(track => track.stop())
            }
        } catch (e) {
            console.log(e)
        }
        // new stream initialize
        window.localStream = stream;
        // Enable/disable tracks according to current toggle state
        if (window.localStream.getVideoTracks().length) {
            window.localStream.getVideoTracks().forEach(t => t.enabled = !!video);
        }
        if (window.localStream.getAudioTracks().length) {
            window.localStream.getAudioTracks().forEach(t => t.enabled = !!audio);
        }
        //if video off we can't see any video
        if (localVideoRef.current) { 
            localVideoRef.current.srcObject = stream; 
        }
        for(let id in connections){
            if(id === socketIdRef.current) continue;
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description)=>{
                connections[id].setLocalDescription(description)
                .then(()=>{
                    socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
                })
                .catch(e => console.log(e))
            })
        }
        // this stream comes from getUserMedia
        // when track ended need to stop video audio and show blacksilence
        stream.getTracks().forEach(track => track.onended =()=>{
            setVideo(false);
            setAudio(false);
            // Clean up the local stream safely
            cleanupLocalStream();
            //need to create blacksilence
            //let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            // window.localStream = blackSilence();
            //if (localVideoRef.current) { localVideoRef.current.srcObject = window.localStream; }
            // Add placeholder stream to peers
            for(let id in connections){
                if (window.localStream) {
                    connections[id].addStream(window.localStream);
                }
                connections[id].createOffer().then((description)=>{
                    connections[id].setLocalDescription(description)
                    .then(()=>{
                        socketRef.current.emit('signal', id, JSON.stringify({'sdp': connections[id].localDescription}))
                    }).catch(e => console.log(e));
                })
            }
        })
    }

    // if we mute audio should be gone if video stop then video not going to appear
   let getUserMedia = async () => {
        // Clean up old stream if it's dead
        if (window.localStream) {
            const allTracksStopped = window.localStream.getTracks().every(t => t.readyState === 'ended');
            if (allTracksStopped) {
                window.localStream = null;
            }
        }
        //Request new stream if none exists
        if (!window.localStream) {
            try {
                // we are in main video call feature not lobby ( we are in connect) current video state
                const stream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                getUserMediaSuccess(stream);
            } catch (err) {
                console.error("Failed to get user media:", err);
            }
        }    
        else {
            // Just toggle tracks if stream exists
            window.localStream.getVideoTracks().forEach(handleToggle('video', video));
            window.localStream.getAudioTracks().forEach(handleToggle('audio', audio));
            if (localVideoRef.current){
                localVideoRef.current.srcObject = window.localStream;
            }
        }
    };
    //this function is for screen share
    let getDisplayMediaSuccess = (stream) => {
        let screenTrack = stream.getVideoTracks()[0];
        setScreen(true);
        setVideos(prev => prev.map(v => v.socketId === socketIdRef.current ? { ...v, isScreen: true } : v));
        socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'screen', enabled: true });
        // Safely swap the local video track without killing the microphone
        if (window.localStream) {
            let cameraTrack = window.localStream.getVideoTracks()[0];
            if (cameraTrack) {
                cameraTrack.stop();
                window.localStream.removeTrack(cameraTrack);
            }
            window.localStream.addTrack(screenTrack);
        } else {
            window.localStream = stream;
        }
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = window.localStream;
        }
        // Send screen instantly to all connected peers
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            let sender = connections[id].getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(screenTrack)
                .then(() => {
                    connections[id].createOffer()
                    .then((description) => connections[id].setLocalDescription(description))
                    .then(() => {
                        socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}));
                    });
                }).catch(e => console.log(e));
            }
        }
        // Listen for browser "Stop Sharing" button
        screenTrack.onended = () => {
            setScreen(false);
            setVideos(prev => prev.map(v => v.socketId === socketIdRef.current ? { ...v, isScreen: false } : v));
            socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'screen', enabled: false });
            // Restore camera
            navigator.mediaDevices.getUserMedia({ video: true, audio: true})
            .then((camStream) => {
                let newCamTrack = camStream.getVideoTracks()[0];
                newCamTrack.enabled = currentVideoState.current;
                if (window.localStream) {
                    let oldScreenTrack = window.localStream.getVideoTracks()[0];
                    if (oldScreenTrack) window.localStream.removeTrack(oldScreenTrack);
                    window.localStream.addTrack(newCamTrack);
                } else {
                    window.localStream = camStream;
                }
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = null; // Clear it first
                    localVideoRef.current.srcObject = window.localStream;
                }
                // Send restored camera back to peers
                for (let id in connections) {
                    if (id === socketIdRef.current) continue;
                    let sender = connections[id].getSenders().find(s => s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(newCamTrack)
                        .then(() => {
                            connections[id].createOffer()
                            .then((description) => connections[id].setLocalDescription(description))
                            .then(() => {
                                socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}));
                            });
                        }).catch(e => console.log(e));
                    }
                }    
            }).catch(e => console.log("Failed to restore camera", e));
        };
    }
    // difficult part
    let gotMessageFromServer =(fromId, message)=>{
        //if signal comes transfer to this
        var signal = JSON.parse(message)
        // I don't send message to me
        if(fromId !== socketIdRef.current){
            if(signal.sdp){
                // take the sended session description and read it
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(()=>{
                    if(signal.sdp.type === "offer"){
                        connections[fromId].createAnswer().then((description)=>{
                            connections[fromId].setLocalDescription(description).then(()=>{
                                // sent signal we accept your offer, now we can talk through stun server
                                socketRef.current.emit("signal", fromId, JSON.stringify({"sdp": connections[fromId].localDescription}))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }
            // if signal is the initial connection
            if(signal.ice){
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }  
        }
    }

    let connectToSocketServer = ()=>{
        socketRef.current = io.connect(server_url, {secure: false})
        //catch server emit message
        socketRef.current.on('signal', gotMessageFromServer);
        socketRef.current.on("connect", ()=>{
            // send the emit message to server
            socketRef.current.emit("join-call", window.location.href,username)
            socketIdRef.current = socketRef.current.id
            socketRef.current.on("chat-message", addMessage)
            socketRef.current.on("user-left", (id)=>{
                setVideos((prevVideos) => prevVideos.filter((v) => v.socketId !== id));
                if (connections[id]) {
                    connections[id].close();
                    delete connections[id];
                }
            })
           socketRef.current.on("media-status-change", (data) => {
                setVideos((prevVideos) =>
                    prevVideos.map((v) =>
                        v.socketId === data.socketId
                        ? { ...v, [data.trackType === 'video' ? 'videoEnabled' : 'audioEnabled']: data.enabled }
                        : v
                    )
                );
            });

            // Existing user detects a newcomer
            socketRef.current.on("user-joined", (incomingSocketId, incomingUsername) => {
                // Pre-create the video card
                setVideos((prevVideos) => {
                    if (!prevVideos.find(v => v.socketId === incomingSocketId)) {
                        return [...prevVideos, {
                            socketId: incomingSocketId,
                            username: incomingUsername,
                            stream: null,
                            videoEnabled: true,
                            audioEnabled: true
                        }];
                    }
                    return prevVideos;
                });
                // Broadcast current media state to the newcomer using reliable refs
                setTimeout(() => {
                    if (socketRef.current) {
                        socketRef.current.emit("media-status-change", {
                            socketId: socketIdRef.current,
                            trackType: 'video',
                            enabled: currentVideoState.current
                        });
                        socketRef.current.emit("media-status-change", {
                            socketId: socketIdRef.current,
                            trackType: 'audio',
                            enabled: currentAudioState.current
                        });
                    }
                }, 1000);
                // Setup WebRTC Connection
                const pc = new RTCPeerConnection(peerConfigConnections);
                connections[incomingSocketId] = pc;
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socketRef.current.emit("signal", incomingSocketId, JSON.stringify({ 'ice': event.candidate }));
                    }   
                };
                // Keep onaddstream for initial handshake compatibility
                pc.onaddstream = (event) => {
                    setVideos((prevVideos) => prevVideos.map(v => v.socketId === incomingSocketId ? { ...v, stream: event.stream } : v));
                };
                // Add ontrack to capture screen-share track swaps
                pc.ontrack = (event) => {
                    const stream = event.streams[0];
                    setVideos((prevVideos) => prevVideos.map(v => v.socketId === incomingSocketId ? { ...v, stream: stream } : v));
                };
                if (window.localStream) {
                    window.localStream.getTracks().forEach(track => pc.addTrack(track, window.localStream));
                }
                pc.createOffer().then((description) => {
                    pc.setLocalDescription(description).then(() => {
                        socketRef.current.emit("signal", incomingSocketId, JSON.stringify({ "sdp": pc.localDescription }));
                    });
                }).catch(e => console.error(e));
            });
            // Newcomer receives the info of existing users
            socketRef.current.on("get-existing-users", (existingUsers) => {
                setVideos((prevVideos) => {
                    const newVideos = [...prevVideos];
                    existingUsers.forEach((user) => {
                        if (user.socketId !== socketIdRef.current && !newVideos.find(v => v.socketId === user.socketId)) {
                            newVideos.push({ socketId: user.socketId, username: user.username, stream: null, videoEnabled: true, audioEnabled: true });
                        }
                    });
                    return newVideos;
                });
                existingUsers.forEach((user) => {
                    if (user.socketId === socketIdRef.current) return;
                    const pc = new RTCPeerConnection(peerConfigConnections);
                    connections[user.socketId] = pc;
                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            socketRef.current.emit("signal", user.socketId, JSON.stringify({ 'ice': event.candidate }));
                        }
                    };
                    pc.onaddstream = (event) => {
                        setVideos((prevVideos) => prevVideos.map(v => v.socketId === user.socketId ? { ...v, stream: event.stream } : v));
                    };
                    pc.ontrack = (event) => {
                        const stream = event.streams[0];
                        setVideos((prevVideos) => prevVideos.map(v => v.socketId === user.socketId ? { ...v, stream: stream } : v));
                    };
                    if (window.localStream) {
                        window.localStream.getTracks().forEach(track => pc.addTrack(track, window.localStream));
                    }
                });
            });
        });
    };
    //Silence function for audio
    let silence=()=>{
        let ctx = new AudioContext();
        // for frequency
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], {enabled: false})
    }
    // black function for black screen
    let black =({width= 640, height= 480}={}) =>{
        let canvas = Object.assign(document.createElement("canvas"), {width, height});
        canvas.getContext('2d').fillRect(0,0,width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], {enabled: false});
    }
    //Stops all media tracks associated with the local video element
    //and clears references to prevent memory leaks or hardware leaks
    const cleanupLocalStream = () => {
        //Stop all tracks (video/audio) currently being played in the UI
        if (localVideoRef.current?.srcObject) {
            const tracks = localVideoRef.current.srcObject.getTracks();
            tracks.forEach(t => t.stop());
            localVideoRef.current.srcObject = null;
        }
        //Remove the stream from all active PeerConnections
        Object.values(connections).forEach(pc => {
            try { pc.removeStream?.(window.localStream); } catch (_) {}
        });
        window.localStream = null;
    };
    // Initialize media based on current toggle states
    const initializeMedia = async (videoState, audioState) => {
        try {
            //Request access to hardware devices
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            // Set initial state of tracks
            stream.getVideoTracks()[0].enabled = videoState;
            stream.getAudioTracks()[0].enabled = audioState;
            window.localStream = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            return stream;
        } catch (err) {
            console.error("Media access denied:", err);
            return null;
        }
    };
    const handleToggle = (trackType, newState) => {
        if (!window.localStream) return;

        // Separate logic: Video toggle should NEVER touch screen tracks
        window.localStream.getVideoTracks().forEach(track => {
            // A robust way to identify the camera track vs screen track
            const isScreen = track.label.toLowerCase().includes('screen') || 
                         track.label.toLowerCase().includes('display');
        
            if (trackType === 'video') {
                if (!isScreen) {
                    track.enabled = newState;
                }
            }
        });

        // Audio is straightforward
        if (trackType === 'audio') {
            window.localStream.getAudioTracks().forEach(track => track.enabled = newState);
        }
        // Notify peers of the status
        if (socketRef.current) {
            socketRef.current.emit("media-status-change", {
                socketId: socketIdRef.current,
                trackType: trackType,
                enabled: newState
            });
        }
    };
    const handleVideo = () => {
        const newState = !video;
        setVideo(newState);
        handleToggle('video', newState);

    };
    const handleAudio = () => {
        const newState = !audio;
        setAudio(newState);
        handleToggle('audio', newState);
    };

    const connect = async () => {
        if (!username || username.trim() === "") {
            alert("Please enter a display name to join the meeting."); 
            return;
        }
        await initializeMedia(video, audio);
        setAskForUsername(false);
        connectToSocketServer();
        // --- Initialize Veri-Human Trackers ---
        //await initializeFaceTracker();
        if (window.localStream) {
            await initializeAudioExtractor(window.localStream);
        }
        
        // Allow DOM elements 200ms to mount before initiating the extraction loop
        setTimeout(() => {
            startMLPipeline();
        }, 300);
        // Small delay ensures socket has fully established room handshakes before broadcasting status
        setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.emit("media-status-change", {
                    socketId: socketIdRef.current,
                    trackType: 'video',
                    enabled: currentVideoState.current
                });
                socketRef.current.emit("media-status-change", {
                    socketId: socketIdRef.current,
                    trackType: 'audio',
                    enabled: currentAudioState.current
                });
            }
        }, 1000);
    };

    /*useEffect(()=>{
        if(screen !== undefined){
            getDisplayMedia();
        }
    }, [screen])*/

    let handleScreen = async () => {
        if (!screen) {
            navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            .then((stream) => {
                getDisplayMediaSuccess(stream);
                setScreen(true);
            })
            .catch((e) => {
                console.log("Screen share failed", e);
                setScreen(false);
            });
        } 
        else {
            // Manually trigger the end event if they click our UI button
            if (window.localStream) {
                let screenTrack = window.localStream.getVideoTracks()[0];
                if (screenTrack) {
                    screenTrack.stop();
                    screenTrack.dispatchEvent(new Event('ended'));
                }
            }
        }
    };

    let addMessage = (data, sender, socketIdSender)=>{
        setMessages((prevMessages)=>[
            //... use for emit previous message
            ...prevMessages,
            {sender: sender, data: data}
        ]);
        // if socketId not me then add message
        if(socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages)=> prevNewMessages+1);
        }
    }

    let sendMessage = ()=>{
        // Check if the socket exists before sending
        if (socketRef.current) {
            socketRef.current.emit("chat-message", message, username);
            setMessage("");
        } else {
            console.error("Socket is not connected. Cannot send message.");
        }
    }
    let routeTo = useNavigate();
    let handleEndCall = () => {
        try {
            // Veri-Human Cleanup Operations 
            // Stop the recursive animation loop
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            
            // Clean up Audio DSP and FaceLandmarker to avoid severe memory leaks
            cleanupAudioExtractor();
            if (typeof cleanupFaceLandmarker === "function") cleanupFaceLandmarker();
            // Explicitly kill every track for both video and audio
            // This is what turns off the physical camera light and cuts the mic
            if (window.localStream) {
                window.localStream.getTracks().forEach((track) => {
                    track.stop();
                });
                window.localStream = null;
            }
            // Clear the video element reference
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
            // Close all active Peer Connections to stop data flow
            Object.values(connections).forEach((pc) => {
                pc.close();
            });
            connections = {};
            //  Disconnect the socket so the server knows you've left
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            //  Reset all React states to prevent ghost data
            setMessages([]);
            setNewMessages(0);
            setVideos([]);
            //Navigate/Reload
            // Using window.location.href acts as a "Hard Refresh"
            // This is the most reliable way to clear all memory and ensure
            // that absolutely no processes remain running in the background.
            window.location.href = "/home";
        } catch (e) {
            console.error("Error during call cleanup:", e);
            window.location.href = "/home";
        }
    }
    return (
        <div className={styles.meetVideoContainer}>
            {/* 
              Veri-Human Hidden Extraction Canvas 
              Crucial: The display is 'none' so it operates strictly in the background
              without disrupting the layout. The ML pipeline interacts with it directly.
            */}
            <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
            {askForUsername === true ? (
                /* lobby create */
                <div className={styles.lobbyContainerLight}>
                    {/* Navbar */}
                    <div className={styles.navbar}>
                        <div className={styles.navBrand}>
                            <img src="/logo.png" alt="logo_image" style = {{width: '60px', height: '106', paddingRight: '16px', angle: '0 deg', opacity: '1', top: '-325px', left: '5969px'}}></img>
                            <span className={styles.meetLogoText}>Veri-Human</span>
                        </div>
                        <div className={styles.navProfile}>
                            <p  className={styles.navLink} onClick={() =>{router("/auth")}}>
                                Register
                            </p>
                            <div className={styles.navButton} onClick={() =>{router("/auth")}} role='button'>
                                <p>Login</p>
                            </div>
                        </div>
                    </div>
                    {/* Main Lobby Content */}
                    <div className={styles.lobbyContent}>
                        {/* Left Panel*/}
                        <div className={styles.videoSection}>
                            <div className={styles.videoPreviewBox}>
                                {/* Always render the video tag so the ref survives, just hide it when off */}
                                <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                className={styles.lobbyVideoPreview}
                                style={{ display: video ? 'block' : 'none' }}
                                />
    
                                {/* Show the text overlay only when the video toggle is false */}
                                {!video && (
                                    <div className={styles.cameraOffText}>Camera is off</div>
                                )}
    
                                <div className={styles.videoOverlayControls}>
                                    <IconButton
                                    onClick={handleAudio}
                                    className={audio ? styles.controlBtnActive : styles.controlBtnInactive}
                                    >
                                        {audio ? <MicIcon /> : <MicOffIcon />}
                                    </IconButton>
                                    <IconButton
                                    onClick={handleVideo}
                                    className={video ? styles.controlBtnActive : styles.controlBtnInactive}
                                    >
                                        {video ? <VideocamIcon /> : <VideocamOffIcon />}
                                    </IconButton>
                                </div>
                            </div>
                        </div>
                        {/* Right Panel*/}
                        <div className={styles.joinPanel}>
                            <h1 className={styles.readyTitle}>Ready to turn conversations into ideas?</h1>
                            <div className={styles.joinActions}>
                                <TextField
                                required 
                                label="Display Name" 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter display name..."
                                variant="standard"
                                InputLabelProps={{
                                    shrink: true,
                                    sx: {
                                        left: 0,
                                        right: 0,
                                        textAlign: 'center',
                                        fontSize: '1.1rem',
                                        transformOrigin: 'center',
                                        color: '#002F06', 
                                        '&.Mui-focused': {
                                            color: '#002F06' // keep the color when the field is clicked
                                        },
                                        '& .Mui-focused:after': { color: '#002F06'}
                                    }
                                }}
                                sx={{ marginBottom: '16px', input: { textAlign: 'center' } ,'& .MuiInput-underline:before': { borderBottomColor: '#002F06'}, '& .MuiInput-underline:after': { borderBottomColor: '#002F06'} , '& .MuiInputLabel-root': {color: '#002F06', width: '100%', textAlign: 'center', transformOrigin: 'top center', fontSize: '1.1rem' },'& .MuiInputLabel-root.Mui-focused': {color: '#002F06'}}}
                                />
                                <Button
                                variant="contained"
                                size="large"
                                onClick={connect}
                                className={styles.joinNowBtn}
                                sx={{background:' #207736', color: 'var(--Schemes-Inverse-On-Surface, #F5EFF7)', borderRadius: '24px', textTransform: 'none', fontSize: '1.15rem', padding: '10px 32px' }}
                                >
                                    Join now
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div style={{
                        position: 'absolute',
                        bottom: '40px',
                        left: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'white',
                        fontFamily: 'sans-serif',
                    }}>
                        <CalendarTodayOutlinedIcon sx={{ fontSize: '1.4rem' }} />
                        <span style={{ 
                            fontSize: '1.4rem', 
                            fontWeight: '300', 
                            margin: '0 12px',
                            opacity: 0.8 
                        }}>|</span>
                        <span style={{ 
                            fontSize: '1.2rem', 
                            fontWeight: '600' 
                        }}>
                            {getFormattedDate()}
                        </span>
                    </div>
                </div>
            ) : (
                <div className={styles.mainMeetingArea}ref={meetingWrapperRef} id="meeting-wrapper">
                    <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', color: 'white', zIndex: 10, fontFamily: 'sans-serif'}}>
                        <span style={{ 
                            fontSize: '1.5rem', 
                            fontWeight: '600',
                            letterSpacing: '0.5px'
                        }}>
                            {getMeetingTime()}
                        </span>
                        <span style={{ 
                            fontSize: '1.5rem', 
                            fontWeight: '300', 
                            margin: '0 12px',
                            opacity: 0.8 
                        }}>
                            |
                        </span>
                        <span style={{ 
                            fontSize: '1.5rem', 
                            fontWeight: '500',
                            letterSpacing: '0.5px'
                        }}>
                            {getMeetingCode()}
                        </span>
                    </div>
                    <div className={styles.videoGridWrapper}>
                        <div className={styles.conferenceView}>
                            {videos.map((videoInfo) => {
                                const isCameraOff = !videoInfo.videoEnabled;
                                const isScreenShare = videoInfo.isScreen;
                                const isAudioOn = videoInfo.audioEnabled ?? true;
                                const displayName = videoInfo.username || "Guest";
                                const showVideo = videoInfo.stream && (!isCameraOff || isScreenShare);
                                return (
                                    <div key={videoInfo.socketId} className={styles.videoCard} style={{ backgroundColor: getAvatarColor(videoInfo.socketId) }}>
                                        <div className={styles.avatarContainer}>
                                            <div className={styles.avatarCircle}>
                                                {getInitial(displayName)}
                                            </div>
                                        </div>
                                        <video
                                        autoPlay
                                        playsInline
                                        className={`${styles.videoStream} ${isScreenShare ? '' : styles.mirror}`}
                                        key={videoInfo.socketId}
                                        style={{ 
                                            opacity: showVideo ? 1 : 0, 
                                            position: showVideo ? 'relative' : 'absolute',
                                            zIndex: showVideo ? 1 : -1,
                                            pointerEvents: showVideo ? 'auto' : 'none'
                                        }}
                                        ref={(ref) => {
                                            if (ref && videoInfo.stream) {
                                                // Only update the source if it has actually changed
                                                if (ref.srcObject !== videoInfo.stream) {
                                                    ref.srcObject = videoInfo.stream;
                                                }
            
                                                // EXPLICITLY force the audio to route to the speakers at full volume
                                                ref.muted = false; 
                                                ref.volume = 1.0;
            
                                                // Catch and log if the browser's autoplay policy tries to block the audio
                                                ref.play().catch(e => console.warn("Browser blocked audio output:", e));
                                                }
                                        }}
                                        />
                                    <div className={styles.muteIconOverlay}>
                                        <div style={{ backgroundColor: isAudioOn ? '#4caf50' : '#d93025', padding: '4px', borderRadius: '50%' }}>
                                            {isAudioOn ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
                                        </div>
                                    </div>
                                    <div className={styles.nameLabel}>{displayName}</div>
                                        <IconButton
                                        className={styles.fullScreenBtn}
                                        onClick={(e) => {
                                            const element = meetingWrapperRef.current;
                                            if (element && element.requestFullscreen) {
                                                element.requestFullscreen();
                                            } else {
                                                console.error("Fullscreen element not found or not supported");
                                            }
                                        }}
                                        >
                                            <FullscreenIcon />
                                        </IconButton>
                                    </div>
                                );
                            })}                        
                        </div>
                        {/* Local Video Picture-in-Picture */}
                        <div
                        className={styles.meetUserVideoContainer}
                        style={{ backgroundColor: (!video && !screen) ? getAvatarColor(username || "Guest") : 'transparent' }}
                        >
                            {!video && !screen && (
                                <div className={styles.avatarContainer}>
                                    <div className={styles.avatarCircle}>
                                        {getInitial(username || "Guest")}
                                    </div>
                                </div>
                            )}
                            <video
                            className={`${styles.meetUserVideo} ${screen ? '' : styles.mirror}`}
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ visibility: (video || screen) ? 'visible' : 'hidden' }}
                            onLoadedMetadata={(e) => e.target.play()}
                            />
                            <div className={styles.nameLabel}>
                                {username || "Guest"} (You)
                            </div>
                            <IconButton
                            className={styles.fullScreenBtn}
                            onClick={(e) => {
                                const element = meetingWrapperRef.current;
                                if (element && element.requestFullscreen) {
                                    element.requestFullscreen();
                                } else {
                                    console.error("Fullscreen element not found or not supported");
                                }
                            }}
                            >
                                <FullscreenIcon />
                            </IconButton>
                        </div>
                        {/* Bottom Control Bar */}
                        <div className={styles.buttonContainers}>
                            <IconButton onClick={handleAudio} sx={{ backgroundColor: '#3c4043', color: 'white', padding: '12px', '&:hover': { backgroundColor: '#5f6368' } }}>
                                {audio ? <MicIcon /> : <MicOffIcon />}
                            </IconButton>
                            <IconButton onClick={handleVideo} sx={{ backgroundColor: '#3c4043', color: 'white', padding: '12px', '&:hover': { backgroundColor: '#5f6368' } }}>
                                {video ? <VideocamIcon /> : <VideocamOffIcon />}
                            </IconButton>
                
                            <IconButton onClick={handleScreen} sx={{ backgroundColor: '#3c4043', color: 'white', padding: '12px', '&:hover': { backgroundColor: '#5f6368' } }}>
                                {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                           
                            <IconButton onClick={handleEndCall} sx={{ backgroundColor: '#ea4335', color: 'white', padding: '12px', margin: '0 10px', '&:hover': { backgroundColor: '#d93025' } }}>
                                <CallEndIcon />
                            </IconButton>
                            <Badge badgeContent={newMessages} max={99} color='error'>
                                <IconButton
                                    onClick={() => {
                                        setModal(!showModal);
                                        if(!showModal) setNewMessages(0); // reset badge when opened
                                    }}
                                    sx={{ backgroundColor: showModal ? '#8ab4f8' : '#3c4043', color: showModal ? '#202124' : 'white', padding: '12px', '&:hover': { backgroundColor: showModal ? '#aecbfa' : '#5f6368' } }}>
                                    <ChatIcon />
                                </IconButton>
                            </Badge>
                        </div>
                    </div>
                    {/* Sliding Chat Panel */}
                    {showModal && (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatHeader}>
                                <h3 style={{ margin: 0, color: '#e8eaed', fontWeight: '500', fontSize: '18px' }}>In-call messages</h3>
                            </div>
                            <div className={styles.chattingDisplay}>
                                {messages.length > 0 ? messages.map((item, index) => (
                                    <div className={styles.messageBubble} key={index}>
                                        <div
                                        className={styles.chatAvatar}
                                        style={{ backgroundColor: getAvatarColor(item.sender) }}
                                        >
                                            {getInitial(item.sender)}
                                        </div>
                                        <div className={styles.messageContent}>
                                            <div className={styles.messageHeader}>
                                                <span className={styles.messageSender}>{item.sender}</span>
                                                <span className={styles.messageTime}>
                                                    {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <p className={styles.messageData}>{item.data}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <p style={{ textAlign: 'center', color: '#9aa0a6', marginTop: '20px', fontSize: '14px', lineHeight: '1.5' }}>
                                        Messages will not be saved for meeting participants when the call ends.
                                    </p>
                                )}
                            </div>
                            <div className={styles.chattingArea}>
                                <TextField
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Send a message"
                                variant="outlined"
                                size="small"
                                fullWidth
                                onKeyPress={(e) => { if(e.key === 'Enter') sendMessage(); }}
                                InputProps={{ 
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={sendMessage} edge="end" sx={{ color: '#8ab4f8' }}>
                                                <SendIcon sx={{ fontSize: '18px' , marginRight: '2px',paddingRight: '4px'}}/>
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    input: { color: '#e8eaed', fontSize: '14px' },
                                    backgroundColor: '#3c4043',
                                    marginRight: '2px',
                                    borderRadius: '24px',
                                    '& .MuiOutlinedInput-root': {
                                        '& fieldset': { border: 'none' },
                                        paddingRight: '4px' 
                                    }
                                }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}