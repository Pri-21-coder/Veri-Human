import React, { useEffect, useRef, useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import io from "socket.io-client";
import {
    Badge, IconButton, TextField, InputAdornment, Button,
    Switch, Drawer, List, ListItem, ListItemText, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, Typography
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from '@mui/icons-material/CallEnd';
import BackHandIcon from '@mui/icons-material/BackHand';
import TagFacesIcon from '@mui/icons-material/TagFaces';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import { useNavigate } from 'react-router-dom';
import server from '../environment';
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
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
    ]
};
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
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoRef = useRef();  
    const remoteVideoRefs = useRef(new Map());
    const audioInitTracker = useRef(new Set()); 
    let hiddenCanvasRef = useRef(null);
    let animationFrameRef = useRef(null);
    let emojiLaneRef = useRef(0);
    const MAX_EMOJI_LANES = 6; 
    const EMOJI_LANE_WIDTH = 65;
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
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");
    let [isHandRaised, setIsHandRaised] = useState(false);
    let [showEmojiPicker, setShowEmojiPicker] = useState(false);
    let [floatingEmojis, setFloatingEmojis] = useState([]);
    let [isHost, setIsHost] = useState(false);
    let [isScreenShareLocked, setIsScreenShareLocked] = useState(false);
    let [meetingState, setMeetingState] = useState("lobby"); 
    let [sidebarTab, setSidebarTab] = useState("none");
    let [waitingUsers, setWaitingUsers] = useState([]);
    let [hostSettings, setHostSettings] = useState({ allowMic: true, allowVideo: true, allowScreen: true, allowChat: true });
    let [showEndCallDialog, setShowEndCallDialog] = useState(false);
    let currentHandState = useRef(isHandRaised);
    useEffect(() => { currentHandState.current = isHandRaised; }, [isHandRaised]);
    let [videos, setVideos] = useState([]);
    const meetingWrapperRef = useRef(null);
    const videosStateRef = useRef([]);
    useEffect(() => { videosStateRef.current = videos; }, [videos]);
    let currentVideoState = useRef(video);
    let currentAudioState = useRef(audio);
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => { currentVideoState.current = video; }, [video]);
    useEffect(() => { currentAudioState.current = audio; }, [audio]);
    const { userData, handleLogout } = useContext(AuthContext);
    const router = useNavigate();
    const roomPath = window.location.pathname.replace(/\/$/, '');
    useEffect(() => {
        if (userData) {
            const displayName =
                userData.user_metadata?.full_name ||
                userData.user_metadata?.name ||
                userData.name ||
                userData.email?.split('@')[0] ||
                "";
            if (displayName && !username) {
                setUsername(displayName);
            }
        }
    }, [userData]);
    useEffect(()=>{
        getPermissions();
        initializeFaceTracker();
    }, [])
    
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const getMeetingTime = () => {
        return currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };
    
    const getMeetingCode = () => {
        const pathParts = window.location.pathname.split('/');
        return pathParts[pathParts.length - 1] || "21"; 
    };

    const getFormattedDate = () => {
        const date = new Date();
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'long' });
        const getOrdinalSuffix = (i) => {
            let j = i % 10, k = i % 100;
            if (j === 1 && k !== 11) return i + "st";
            if (j === 2 && k !== 12) return i + "nd";
            if (j === 3 && k !== 13) return i + "rd";
            return i + "th";
        };
        return `${getOrdinalSuffix(day)} ${month}`;
    };

    const getPermissions = async() => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({video: true});
            if(videoPermission) setVideoAvailable(true);
            else setVideoAvailable(false);
            
            const audioPermission = await navigator.mediaDevices.getUserMedia({audio: true});
            if(audioPermission) setAudioAvailable(true);
            else setAudioAvailable(false);
            
            if(navigator.mediaDevices.getDisplayMedia) setScreenAvailable(true);
            else setScreenAvailable(false);
        }catch(err) {
            console.log(err)
        }
    }

    useEffect(() => {
        if (!askForUsername && localVideoRef.current) {
            if (window.localStream) {
                localVideoRef.current.srcObject = window.localStream;
                localVideoRef.current.play().catch(e => console.log("Play failed:", e));
            }
        }
    }, [askForUsername]); 

    const startMLPipeline = () => {
        let frameCount = 0;
        let lastPlosiveWarningTime = 0;
        console.log("[Veri-Human] Remote ML Pipeline Loop Started.");

        const processFrame = async () => {
            try {
                remoteVideoRefs.current.forEach((remoteVid, socketId) => {
                    const userState = videosStateRef.current.find(v => v.socketId === socketId);
                    // Defaults set to false ensures ghost frames don't process before socket confirms
                    const isVideoActive = userState ? (userState.videoEnabled ?? false) : false;
                    const isAudioActive = userState ? (userState.audioEnabled ?? false) : false;
                    const isScreenShare = userState ? (userState.isScreen ?? false) : false;

                    if (!isVideoActive && !isAudioActive && !isScreenShare) {
                        if (audioInitTracker.current.has(socketId)) {
                            cleanupAudioExtractor(socketId);
                            audioInitTracker.current.delete(socketId);
                        }
                        return;
                    }
                    let audioData = null;
                    if (isAudioActive) {
                        if (remoteVid && remoteVid.srcObject && remoteVid.srcObject.getAudioTracks().length > 0) {
                            if (!audioInitTracker.current.has(socketId)) {
                                audioInitTracker.current.add(socketId);
                                initializeAudioExtractor(socketId, remoteVid.srcObject).catch(e => console.error(e));
                            }
                        }
                        audioData = extractAudioFeatures(socketId);
                    } else {
                        if (audioInitTracker.current.has(socketId)) {
                            cleanupAudioExtractor(socketId);
                            audioInitTracker.current.delete(socketId);
                        }
                    }
                    let visualDataArray = null;
                    if (
                        (isVideoActive || isScreenShare) &&
                        remoteVid && 
                        hiddenCanvasRef.current && 
                        remoteVid.readyState >= 2 && 
                        remoteVid.videoWidth > 0 &&
                        remoteVid.videoHeight > 0 &&
                        !remoteVid.paused
                    ) {
                        visualDataArray = extractFacialFeatures(remoteVid, hiddenCanvasRef.current);
                    }
                    if (visualDataArray || audioData) {
                        frameCount++;
                        if (frameCount % 15 === 0) {
                            if (Array.isArray(visualDataArray) && visualDataArray.length > 0) {
                                visualDataArray.forEach(face => {
                                    console.log(`[Veri-Human Remote ML - User ${socketId} - Face ${face.faceIndex}]`, {
                                        ear_liveness: face.ear?.toFixed(3) || "N/A",
                                        mar_lipsync: face.mar?.toFixed(3) || "N/A",
                                        plosive_spike: audioData ? audioData.isPlosiveSpike : false,
                                        mfcc_0: audioData && audioData.mfccArray ? audioData.mfccArray[0]?.toFixed(2) : "No Audio",
                                        timestamp: performance.now()
                                    });
                                });
                            } else if (audioData && !isVideoActive) {
                                console.log(`[Veri-Human Remote ML - Audio Only - User ${socketId}]`, {
                                    ear_liveness: "Camera Off",
                                    mar_lipsync: "Camera Off",
                                    plosive_spike: audioData.isPlosiveSpike,
                                    mfcc_0: audioData.mfccArray ? audioData.mfccArray[0]?.toFixed(2) : "No Audio",
                                    timestamp: performance.now()
                                });
                            }
                        }
                        if (audioData?.isPlosiveSpike && Array.isArray(visualDataArray)) {
                            const now = performance.now();
                            if (now - lastPlosiveWarningTime > 1000) {
                                visualDataArray.forEach(face => {
                                    if (face.mar > 0.15) {
                                        console.warn(`[Veri-Human Alert - User ${socketId}] Remote Lip-sync Desync: Plosive detected but mouth is open! MAR: ${face.mar.toFixed(3)}`);
                                        lastPlosiveWarningTime = now;
                                    }
                                });
                            }
                        }
                    }
                });
            } catch (err) {
                console.error("[Veri-Human ML Pipeline Error]", err);
            } finally {
                animationFrameRef.current = requestAnimationFrame(processFrame);
            }
        };
        processFrame();
    };

    let gotMessageFromServer =(fromId, message)=>{
        var signal = JSON.parse(message)
        if(fromId !== socketIdRef.current){
            if(signal.sdp){
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(()=>{
                    if(signal.sdp.type === "offer"){
                        connections[fromId].createAnswer().then((description)=>{
                            connections[fromId].setLocalDescription(description).then(()=>{
                                socketRef.current.emit("signal", fromId, JSON.stringify({"sdp": connections[fromId].localDescription}))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }
            if(signal.ice){
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
            }
        }
    }
    let connectToSocketServer = ()=>{
        socketRef.current = io.connect(server_url, {secure: false})
        socketRef.current.on('signal', gotMessageFromServer); 
        socketRef.current.on("connect", ()=>{    
            socketRef.current.on("media-status-change", (data) => {
                setVideos((prevVideos) => prevVideos.map((v) => {
                    if (v.socketId === data.socketId) {
                        if (data.trackType === 'screen') return { ...v, isScreen: data.enabled };
                        return { ...v, [data.trackType === 'video' ? 'videoEnabled' : 'audioEnabled']: data.enabled };
                    }
                    return v;
                }));
            });
            socketRef.current.on("role-assignment", (role) => { 
                setIsHost(role === "host"); 
            });       
            socketRef.current.on("wait-for-host", () => {
                setMeetingState("waiting")
            });          
            socketRef.current.on("admitted", (settings) => {
                setHostSettings(settings);
                setMeetingState("joined"); 
                if (!settings.allowMic && currentAudioState.current) handleAudio();
                if (!settings.allowVideo && currentVideoState.current) handleVideo();
                if (!settings.allowScreen && screen) handleScreen();
            });
            socketRef.current.on("denied", () => {
                setMeetingState("denied");
                cleanupLocalStream();
            });
            socketRef.current.on("user-waiting", (users) => {
                setWaitingUsers(users)
            });
            socketRef.current.on("host-settings-updated", (newSettings) => {
                setHostSettings(newSettings);
                if (!newSettings.allowMic && audio) handleAudio();
                if (!newSettings.allowVideo && video) handleVideo();
                if (!newSettings.allowScreen && screen) handleScreen();
            });
            socketRef.current.on("meeting-ended-by-host", () => {
                alert("The host has ended the meeting for everyone.");
                executeLeaveCall();
            });
            socketRef.current.on("force-mute", () => {
                setAudio(false);
                handleToggle('audio', false);
            });            
            socketRef.current.on("kicked", () => {
                handleEndCall(); 
                alert("You have been removed from the meeting by the host.");
            });           
            socketRef.current.on("screen-share-lock-updated", (locked) => {
                setIsScreenShareLocked(locked);
                if (locked && screen) {
                    if (window.localStream) {
                        let screenTrack = window.localStream.getVideoTracks().find(t => t.label.toLowerCase().includes('screen') || t.label.toLowerCase().includes('display'));
                        if (screenTrack) {
                            screenTrack.stop();
                            screenTrack.dispatchEvent(new Event('ended'));
                        }
                    }
                }
            });
            socketRef.current.on("chat-message", addMessage)           
            socketRef.current.on("receive-emoji", (data) => {
                const currentLane = emojiLaneRef.current;
                emojiLaneRef.current = (emojiLaneRef.current + 1) % MAX_EMOJI_LANES;
                const calculatedLeftOffset = currentLane * EMOJI_LANE_WIDTH;
                const newEmoji = { id: Date.now() + Math.random(), emoji: data.emoji, senderName: data.senderName, leftOffset: calculatedLeftOffset };
                setFloatingEmojis((prev) => [...prev, newEmoji]);
                setTimeout(() => { setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id)); }, 4000);
            });
            socketRef.current.on("user-left", (id)=>{
                setVideos((prevVideos) => prevVideos.filter((v) => v.socketId !== id));
                cleanupAudioExtractor(id);
                audioInitTracker.current.delete(id);
                if (connections[id]) {
                    connections[id].close();
                    delete connections[id];
                }
            })
            socketRef.current.on("hand-status-change", (data) => {
                setVideos((prevVideos) =>
                    prevVideos.map((v) =>
                        v.socketId === data.socketId ? { ...v, handRaised: data.raised } : v
                    )
                );
            });
            socketRef.current.on("user-joined", (incomingSocketId, incomingUsername) => {
                setVideos((prevVideos) => {
                    if (!prevVideos.find(v => v.socketId === incomingSocketId)) {
                        return [...prevVideos, { socketId: incomingSocketId, username: incomingUsername, stream: null, videoEnabled: false, audioEnabled: false, handRaised: false }];
                    }
                    return prevVideos;
                });
                setTimeout(() => {
                    if (socketRef.current) {
                        socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'video', enabled: currentVideoState.current });
                        socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'audio', enabled: currentAudioState.current });
                        socketRef.current.emit("hand-status-change", { raised: currentHandState.current });
                    }
                }, 1000);
                const pc = new RTCPeerConnection(peerConfigConnections);
                connections[incomingSocketId] = pc;
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socketRef.current.emit("signal", incomingSocketId, JSON.stringify({ 'ice': event.candidate }));
                    }
                };
                pc.onaddstream = (event) => {
                    setVideos((prevVideos) => prevVideos.map(v => v.socketId === incomingSocketId ? { ...v, stream: event.stream } : v));
                };
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
            socketRef.current.on("get-existing-users", (existingUsers) => {
                setMeetingState("joined");              
                setVideos((prevVideos) => {
                    const newVideos = [...prevVideos];
                    existingUsers.forEach((user) => {
                        if (user.socketId !== socketIdRef.current && !newVideos.find(v => v.socketId === user.socketId)) {
                            newVideos.push({ socketId: user.socketId, username: user.username, stream: null, videoEnabled: false, audioEnabled: false, handRaised: false });
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
            socketIdRef.current = socketRef.current.id;
            socketRef.current.emit("join-call", roomPath, username, userData?.id);
        });
    };
    const cleanupLocalStream = () => {
        if (localVideoRef.current?.srcObject) {
            const tracks = localVideoRef.current.srcObject.getTracks();
            tracks.forEach(t => t.stop());
            localVideoRef.current.srcObject = null;
        }
        Object.values(connections).forEach(pc => {
            try { pc.removeStream?.(window.localStream); } catch (_) {}
        });
        window.localStream = null;
    };
    const initializeMedia = async (videoState, audioState) => {
        try {
            if (!videoState && !audioState) {
                window.localStream = null;
                return null;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ video: videoState, audio: audioState });
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
        if (window.localStream) {
            window.localStream.getTracks().forEach(track => {
                const isScreen = track.label.toLowerCase().includes('screen') || track.label.toLowerCase().includes('display');
                if (trackType === 'video' && track.kind === 'video' && !isScreen) {
                    track.enabled = newState;
                }
                if (trackType === 'audio' && track.kind === 'audio') {
                    track.enabled = newState;
                }
            });
        }
        if (socketRef.current) {
            socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType, enabled: newState });
        }
    };
    const handleVideo = async () => {
        const newState = !video;
        setVideo(newState);
        if (!window.localStream || window.localStream.getVideoTracks().length === 0) {
            if (newState) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const newTrack = stream.getVideoTracks()[0];                
                    if (!window.localStream) window.localStream = new MediaStream();
                    window.localStream.addTrack(newTrack);
                    if (localVideoRef.current) localVideoRef.current.srcObject = window.localStream;                 
                    for (let id in connections) {
                        const pc = connections[id];
                        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(newTrack).catch(console.error);
                        } else {
                            pc.addTrack(newTrack, window.localStream);
                            pc.createOffer().then(desc => pc.setLocalDescription(desc))
                              .then(() => socketRef.current.emit("signal", id, JSON.stringify({"sdp": pc.localDescription})));
                        }
                    }
                } catch (e) {
                    console.error("Camera access denied:", e);
                    setVideo(false);
                    return;
                }
            }
        }  
        handleToggle('video', newState);
    };
    const handleAudio = async () => {
        const newState = !audio;
        setAudio(newState);     
        if (!window.localStream || window.localStream.getAudioTracks().length === 0) {
            if (newState) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const newTrack = stream.getAudioTracks()[0];
                    
                    if (!window.localStream) window.localStream = new MediaStream();
                    window.localStream.addTrack(newTrack);
                    if (localVideoRef.current) localVideoRef.current.srcObject = window.localStream;
                    
                    for (let id in connections) {
                        const pc = connections[id];
                        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                        if (sender) {
                            sender.replaceTrack(newTrack).catch(console.error);
                        } else {
                            pc.addTrack(newTrack, window.localStream);
                            pc.createOffer().then(desc => pc.setLocalDescription(desc))
                              .then(() => socketRef.current.emit("signal", id, JSON.stringify({"sdp": pc.localDescription})));
                        }
                    }
                } catch (e) {
                    console.error("Microphone access denied:", e);
                    setAudio(false);
                    return;
                }
            }
        }   
        handleToggle('audio', newState);
    };

    const handleRaiseHand = () => {
        const newState = !isHandRaised;
        setIsHandRaised(newState);
        if (socketRef.current) {
            socketRef.current.emit("hand-status-change", { raised: newState });
        }
    };

    const handleSendEmoji = (emoji) => {
        if (socketRef.current) {
            socketRef.current.emit("send-emoji", { emoji: emoji, senderName: username || "Guest" });
        }      
        const currentLane = emojiLaneRef.current;
        emojiLaneRef.current = (emojiLaneRef.current + 1) % MAX_EMOJI_LANES;
        const calculatedLeftOffset = currentLane * EMOJI_LANE_WIDTH;
        const newEmoji = { id: Date.now() + Math.random(), emoji, senderName: "You", leftOffset: calculatedLeftOffset };
        setFloatingEmojis((prev) => [...prev, newEmoji]);      
        setTimeout(() => {
            setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
        }, 4000);
    };

    const connect = async () => {
        if (!username || username.trim() === "") {
            alert("Please enter a display name to join the meeting.");
            return;
        }
        await initializeMedia(video, audio);
        setAskForUsername(false);
        setMeetingState("connecting");
        connectToSocketServer();      
        setTimeout(() => {
            startMLPipeline();
        }, 300);
        setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'video', enabled: currentVideoState.current });
                socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'audio', enabled: currentAudioState.current });
            }
        }, 1000);
    };

    let handleScreen = async () => {
        if (isScreenShareLocked && !isHost) {
            alert("The host has disabled screen sharing for participants.");
            return;
        }
        if (!screen) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const screenTrack = stream.getVideoTracks()[0];
                setScreen(true);    
                if (window.localStream) {
                    const cameraTrack = window.localStream.getVideoTracks().find(t => t.kind === 'video');
                    if (cameraTrack) cameraTrack.enabled = false; 
                    window.localStream.addTrack(screenTrack);
                } else {
                    window.localStream = stream;
                }             
                if (localVideoRef.current) localVideoRef.current.srcObject = window.localStream;
                for (let id in connections) {
                    const pc = connections[id];
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(screenTrack).catch(console.error);
                    } else {
                        pc.addTrack(screenTrack, window.localStream);
                        pc.createOffer().then(desc => pc.setLocalDescription(desc))
                          .then(() => socketRef.current.emit("signal", id, JSON.stringify({"sdp": pc.localDescription})));
                    }
                }
                socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'screen', enabled: true });
                screenTrack.onended = () => {
                    setScreen(false);
                    socketRef.current.emit("media-status-change", { socketId: socketIdRef.current, trackType: 'screen', enabled: false });
                    
                    window.localStream.removeTrack(screenTrack);
                    
                    const cameraTrack = window.localStream.getVideoTracks().find(t => t.kind === 'video');
                    if (cameraTrack) {
                        cameraTrack.enabled = currentVideoState.current;
                        for (let id in connections) {
                            const sender = connections[id].getSenders().find(s => s.track && (s.track.kind === 'video' || s.track.label.includes('screen')));
                            if (sender) {
                                sender.replaceTrack(cameraTrack).catch(console.error);
                            }
                        }
                    } else if (currentVideoState.current) {
                        handleVideo();
                    }
                    if (localVideoRef.current) localVideoRef.current.srcObject = window.localStream;
                };
            } catch (e) {
                console.log("Screen share failed or cancelled", e);
                setScreen(false);
            }
        } else {
            if (window.localStream) {
                const screenTrack = window.localStream.getVideoTracks().find(t => t.label.toLowerCase().includes('screen') || t.label.toLowerCase().includes('display'));
                if (screenTrack) {
                    screenTrack.stop();
                    screenTrack.dispatchEvent(new Event('ended'));
                } else {
                    setScreen(false);
                }
            }
        }
    };
    let addMessage = (data, sender, socketIdSender)=>{
        setMessages((prevMessages)=>[...prevMessages, {sender: sender, data: data}]);
        if(socketIdSender !== socketIdRef.current) setNewMessages((prevNewMessages)=> prevNewMessages+1);
    }

    let sendMessage = ()=>{
        if (socketRef.current) {
            socketRef.current.emit("chat-message", message, username);
            setMessage("");
        } else {
            console.error("Socket is not connected. Cannot send message.");
        }
    }

    let routeTo = useNavigate();

    const executeLeaveCall = () => {
        try {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            cleanupAudioExtractor();
            audioInitTracker.current.clear();
            if (typeof cleanupFaceLandmarker === "function") cleanupFaceLandmarker();
            
            if (window.localStream) {
                window.localStream.getTracks().forEach((track) => track.stop());
                window.localStream = null;
            }
            
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            
            Object.values(connections).forEach((pc) => pc.close());
            connections = {};
            
            if (socketRef.current) socketRef.current.disconnect();
            
            setMessages([]);
            setNewMessages(0);
            setVideos([]);
            
            window.location.href = "/home";
        } catch (e) {
            console.error("Error during call cleanup:", e);
            window.location.href = "/home";
        }
    };

    const handleEndCall = () => {
        if (isHost) setShowEndCallDialog(true);
        else executeLeaveCall();
    };

    const executeEndCallForAll = () => {
        if (socketRef.current) socketRef.current.emit("end-meeting-for-all", roomPath);
        executeLeaveCall();
    };

    const allRaisedHands = [
        ...(isHandRaised ? [{ id: 'local', name: username || "You" }] : []),
        ...videos.filter(v => v.handRaised).map(v => ({ id: v.socketId, name: v.username || "Guest" }))
    ];

    const isMicDisabled = !isHost && !hostSettings.allowMic;
    const isVideoDisabled = !isHost && !hostSettings.allowVideo;
    const isScreenDisabled = !isHost && !hostSettings.allowScreen;
    const isChatDisabled = !isHost && !hostSettings.allowChat;

    return (
        <div className={styles.meetVideoContainer}>
            <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />
            
            {askForUsername || meetingState === "lobby" ? (
                <div className={styles.lobbyContainerLight}>
                    <div className={styles.navbar}>
                        <div className={styles.navBrand}>
                            <img src="/logo.png" alt="logo_image" style = {{width: '60px', height: '106', paddingRight: '16px', angle: '0 deg', opacity: '1', top: '-325px', left: '5969px'}}></img>
                            <span className={styles.meetLogoText}>Veri-Human</span>
                        </div>
                        <div className={styles.navProfile}>
                            {userData ? (
                                <>
                                    <p className={styles.navLink}>
                                        {userData.user_metadata?.full_name || userData.email}
                                    </p>
                                    <div className={styles.navButton} onClick={handleLogout} role='button'>
                                        <p>Logout</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className={styles.navLink} onClick={() => { router("/auth"); }}>
                                        Register
                                    </p>
                                    <div className={styles.navButton} onClick={() => { router("/auth"); }} role='button'>
                                        <p>Login</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className={styles.lobbyContent}>
                        <div className={styles.videoSection}>
                            <div className={styles.videoPreviewBox}>
                                <video ref={localVideoRef} autoPlay muted className={styles.lobbyVideoPreview} style={{ display: video ? 'block' : 'none' }} />
                                {!video && (<div className={styles.cameraOffText}>Camera is off</div>)}
                                <div className={styles.videoOverlayControls}>
                                    <IconButton onClick={handleAudio} className={audio ? styles.controlBtnActive : styles.controlBtnInactive}>{audio ? <MicIcon /> : <MicOffIcon />}</IconButton>
                                    <IconButton onClick={handleVideo} className={video ? styles.controlBtnActive : styles.controlBtnInactive}>{video ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
                                </div>
                            </div>
                        </div>
                        <div className={styles.joinPanel}>
                            <h1 className={styles.readyTitle}>Ready to turn conversations into ideas?</h1>
                            <div className={styles.joinActions}>
                                <TextField required label="Display Name" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter display name..." variant="standard" InputLabelProps={{ shrink: true, sx: { left: 0, right: 0, textAlign: 'center', fontSize: '1.1rem', transformOrigin: 'center', color: '#002F06', '&.Mui-focused': { color: '#002F06' }, '& .Mui-focused:after': { color: '#002F06'} } }} sx={{ marginBottom: '16px', input: { textAlign: 'center' } ,'& .MuiInput-underline:before': { borderBottomColor: '#002F06'}, '& .MuiInput-underline:after': { borderBottomColor: '#002F06'} , '& .MuiInputLabel-root': {color: '#002F06', width: '100%', textAlign: 'center', transformOrigin: 'top center', fontSize: '1.1rem' },'& .MuiInputLabel-root.Mui-focused': {color: '#002F06'}}} />
                                <Button variant="contained" size="large" onClick={connect} className={styles.joinNowBtn} sx={{background:' #207736', color: 'var(--Schemes-Inverse-On-Surface, #F5EFF7)', borderRadius: '24px', textTransform: 'none', fontSize: '1.15rem', padding: '10px 32px' }}>Join now</Button>
                            </div>
                        </div>
                    </div>
                    <div style={{ position: 'absolute', bottom: '40px', left: '40px', display: 'flex', alignItems: 'center', color: 'white', fontFamily: 'sans-serif' }}>
                        <CalendarTodayOutlinedIcon sx={{ fontSize: '1.4rem' }} />
                        <span style={{ fontSize: '1.4rem', fontWeight: '300', margin: '0 12px', opacity: 0.8 }}>|</span>
                        <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>{getFormattedDate()}</span>
                    </div>
                </div>
            ) : meetingState === "waiting" || meetingState === "connecting" ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>
                    <img src="/waiting-illustration.png" alt="Waiting" style={{ width: '300px', marginBottom: '20px' }} />
                    <h2>Connecting...</h2>
                    <p>Please wait until a meeting host brings you into the call</p>
                </div>
            ) : meetingState === "denied" ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
                    <h2>The host denied your entry.</h2>
                </div>
            ) : (
                <div className={styles.mainMeetingArea}ref={meetingWrapperRef} id="meeting-wrapper">
                    
                    <div className={styles.floatingEmojiContainer}>
                        {floatingEmojis.map((item) => (
                            <div key={item.id} className={styles.floatingEmojiWrapper}>
                                <div style={{ fontSize: '48px' }}>{item.emoji}</div>
                                <div className={styles.nameLabel} style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', marginTop: '4px', whiteSpace: 'nowrap', fontWeight: 'bold' }}>{item.senderName}</div>
                            </div>
                        ))}
                    </div>

                    <div className={styles.navBar} style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', alignItems: 'center', color: 'white', zIndex: 10, fontFamily: 'sans-serif'}}>
                        <span style={{ fontSize: '1.5rem', fontWeight: '600', letterSpacing: '0.5px' }}>{getMeetingTime()}</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '300', margin: '0 12px', opacity: 0.8 }}>|</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '500', letterSpacing: '0.5px' }}>{getMeetingCode()}</span>
                    </div>

                    <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '16px', zIndex: 100 }}>
                        <IconButton onClick={() => setSidebarTab(sidebarTab === 'people' ? 'none' : 'people')} sx={{ color: 'white', backgroundColor: '#3c4043' }}>
                            <Badge badgeContent={videos.length + 1} color="primary"><PeopleIcon /></Badge>
                        </IconButton>
                        {isHost && (
                            <IconButton onClick={() => setSidebarTab(sidebarTab === 'controls' ? 'none' : 'controls')} sx={{ color: 'white', backgroundColor: '#3c4043' }}>
                                <AdminPanelSettingsIcon />
                            </IconButton>
                        )}
                    </div>

                    <div style={{ position: 'absolute', top: '24px', right: '120px', display: 'flex', gap: '8px', zIndex: 10 }}>
                        {allRaisedHands.map((person) => (
                            <div key={person.id} style={{ backgroundColor: '#000000', opacity: '70%', color: '#81c995', padding: '11px 12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: '500', fontSize: '18px' }}>
                                <BackHandIcon sx={{ fontSize: '16px' }} />{person.name}
                            </div>
                        ))}
                    </div>

                    <div className={styles.videoGridWrapper}>
                        <div className={styles.conferenceView}>
                            {videos.map((videoInfo) => {
                                const isCameraOff = !videoInfo.videoEnabled;
                                const isScreenShare = videoInfo.isScreen;
                                const isAudioOn = videoInfo.audioEnabled ?? false;
                                const displayName = videoInfo.username || "Guest";
                                const showVideo = videoInfo.stream && (!isCameraOff || isScreenShare);

                                return (
                                    <div key={videoInfo.socketId} className={styles.videoCard} style={{ backgroundColor: getAvatarColor(videoInfo.socketId) }}>
                                        <div className={styles.avatarContainer}>
                                            <div className={styles.avatarCircle}>{getInitial(displayName)}</div>
                                        </div>
                                        <video
                                        autoPlay
                                        playsInline
                                        className={`${styles.videoStream} ${isScreenShare ? '' : styles.mirror}`}
                                        key={videoInfo.socketId}
                                        style={{ opacity: showVideo ? 1 : 0, position: showVideo ? 'relative' : 'absolute', zIndex: showVideo ? 1 : -1, pointerEvents: showVideo ? 'auto' : 'none' }}
                                        ref={(ref) => {
                                            if (ref) {
                                                remoteVideoRefs.current.set(videoInfo.socketId, ref);
                                                
                                                if (videoInfo.stream && ref.srcObject !== videoInfo.stream) {
                                                    ref.srcObject = videoInfo.stream;
                                                    ref.muted = false; 
                                                    ref.volume = 1.0;
                                                    
                                                    ref.play().then(() => {
                                                        if (videoInfo.stream && videoInfo.stream.getAudioTracks().length > 0) {
                                                            cleanupAudioExtractor(videoInfo.socketId);
                                                            initializeAudioExtractor(videoInfo.socketId, videoInfo.stream).catch(e => console.error(e));
                                                        }
                                                    }).catch(e => console.warn("Browser blocked audio output:", e));
                                                }
                                            } else {
                                                remoteVideoRefs.current.delete(videoInfo.socketId);
                                            }
                                        }}
                                        />
                                        
                                        <div className={styles.muteIconOverlay}>
                                        <div style={{ backgroundColor: isAudioOn ? '#4caf50' : '#d93025', padding: '4px', borderRadius: '50%' }}>
                                            {isAudioOn ? <MicIcon fontSize="small" /> : <MicOffIcon fontSize="small" />}
                                        </div>
                                    </div>
                                        
                                        <div className={styles.nameLabel}style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: videoInfo.handRaised ? '4px 12px' : '4px 8px', backgroundColor: videoInfo.handRaised ? '#81c995' : 'rgba(0,0,0,0.6)', color: videoInfo.handRaised ? '#0d3a1f' : 'white', borderRadius: '16px' }}>
                                            {videoInfo.handRaised && <BackHandIcon sx={{ fontSize: '16px' }} />}{displayName}</div>
                                        <IconButton className={styles.fullScreenBtn} onClick={(e) => { const element = meetingWrapperRef.current; if (element && element.requestFullscreen) { element.requestFullscreen(); } else { console.error("Fullscreen element not found or not supported"); } }}>
                                            <FullscreenIcon />
                                        </IconButton>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className={styles.meetUserVideoContainer} style={{ backgroundColor: (!video && !screen) ? getAvatarColor(username || "Guest") : 'transparent' }}>
                            {!video && !screen && (
                                <div className={styles.avatarContainer}>
                                    <div className={styles.avatarCircle}>{getInitial(username || "Guest")}</div>
                                </div>
                            )}

                            <video className={`${styles.meetUserVideo} ${screen ? '' : styles.mirror}`} ref={localVideoRef} autoPlay playsInline muted style={{ visibility: (video || screen) ? 'visible' : 'hidden' }} onLoadedMetadata={(e) => e.target.play()} />
                            
                            <div className={styles.nameLabel}style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isHandRaised ? '4px 12px' : '4px 8px', backgroundColor: isHandRaised ? '#81c995' : '', color: isHandRaised ? '#0d3a1f' : 'white', borderRadius: '16px' }}>
                                {isHandRaised && <BackHandIcon sx={{ fontSize: '16px' }} />}
                                {username || "Guest"} (You) {screen ? " - Presenting" : ""}
                            </div>
                            <IconButton className={styles.fullScreenBtn} onClick={(e) => { const element = meetingWrapperRef.current; if (element && element.requestFullscreen) { element.requestFullscreen(); } else { console.error("Fullscreen element not found or not supported"); } }}>
                                <FullscreenIcon />
                            </IconButton>
                        </div>
                        
                        <div className={styles.buttonContainers}>
                            <IconButton onClick={handleAudio} disabled={isMicDisabled} sx={{ backgroundColor: audio ? '#3c4043' : '#FF383C', color: 'white', padding: '12px', opacity: isMicDisabled ? 0.5 : 1, '&:hover': { backgroundColor: audio ? '#5f6368' : '#c44143' } }}>{audio ? <MicIcon /> : <MicOffIcon />}</IconButton>
                            <IconButton onClick={handleVideo} disabled={isVideoDisabled} sx={{ backgroundColor: video ? '#3c4043' : '#FF383C', color: 'white', padding: '12px', opacity: isVideoDisabled ? 0.5 : 1, '&:hover': { backgroundColor: video ? '#5f6368' : '#c44143' } }}>{video ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
                            <IconButton onClick={handleRaiseHand} sx={{ backgroundColor: '#3c4043', color: 'white', padding: '12px', '&:hover': { backgroundColor: '#5f6368' } }}><BackHandIcon /></IconButton>
                            <IconButton onClick={handleScreen} disabled={isScreenDisabled} sx={{ backgroundColor: '#3c4043', color: 'white', padding: '12px', opacity: isScreenDisabled ? 0.5 : 1, '&:hover': { backgroundColor: '#5f6368' } }}>{screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}</IconButton>
                            <div style={{ position: 'relative' }}>
                                {showEmojiPicker && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '60px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        backgroundColor: '#202124',
                                        borderRadius: '24px',
                                        padding: '12px 16px',
                                        display: 'flex',
                                        gap: '12px',
                                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                        zIndex: 100
                                    }}>
                                        {['💖', '👍', '🎉', '😂', '😮', '😢', '🤔', '👎'].map(em => (
                                            <span 
                                                key={em} 
                                                onClick={() => handleSendEmoji(em)} 
                                                style={{ cursor: 'pointer', fontSize: '24px', transition: 'transform 0.1s' }}
                                                onMouseOver={(e) => e.target.style.transform = 'scale(1.2)'}
                                                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
                                            >
                                                {em}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <IconButton 
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                                    sx={{ 
                                        backgroundColor: showEmojiPicker ? '#8ab4f8' : '#3c4043', 
                                        color: showEmojiPicker ? '#202124' : 'white', 
                                        padding: '12px', 
                                        '&:hover': { backgroundColor: showEmojiPicker ? '#aecbfa' : '#5f6368' } 
                                    }}>
                                    <TagFacesIcon/>
                                </IconButton>
                            </div>
                            <IconButton onClick={handleEndCall} sx={{ backgroundColor: '#ea4335', color: 'white', padding: '12px', '&:hover': { backgroundColor: '#d93025' } }}><CallEndIcon /></IconButton>
                            
                            <Badge badgeContent={newMessages} max={99} color='error'>
                                <IconButton
                                    onClick={() => {
                                        setModal(!showModal);
                                        if(!showModal) setNewMessages(0); 
                                    }}
                                    sx={{ backgroundColor: showModal ? '#8ab4f8' : '#3c4043', color: showModal ? '#202124' : 'white', padding: '12px', '&:hover': { backgroundColor: showModal ? '#aecbfa' : '#5f6368' } }}>
                                    <ChatIcon />
                                </IconButton>
                            </Badge>
                        </div>
                    </div>
                    
                    {showModal && (
                        <div className={styles.chatRoom}>
                            <div className={styles.chatHeader}>
                                <h3 style={{ margin: 0, color: '#e8eaed', fontWeight: '500', fontSize: '30px' }}>In-call messages</h3>
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
                                    <p style={{ color: '#9aa0a6',  fontSize: '16px', lineHeight: '1.5' , opacity: '70%' }}>
                                        Messages will disappear after the end of this call.
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
                                    backgroundColor: 'var(--Labels---Vibrant---Controls-Secondary, #727272)',
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
                    
                    <Drawer anchor="right" open={sidebarTab !== 'none'} onClose={() => setSidebarTab('none')} PaperProps={{ sx: { width: 360, backgroundColor: '#202124', color: 'white', marginTop: '80px', borderRadius: '16px 0 0 16px' } }}>
                        {sidebarTab === 'people' && (
                            <div style={{ padding: '20px' }}>
                                <h3>People</h3>
                                {isHost && waitingUsers.length > 0 && (
                                    <>
                                        <h4 style={{ color: '#8ab4f8' }}>Waiting to join ({waitingUsers.length})</h4>
                                        {waitingUsers.map(user => (
                                            <div key={user.socketId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#3c4043', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
                                                <span>{user.username}</span>
                                                <div>
                                                    <Button onClick={() => socketRef.current.emit('deny-user', roomPath, user.socketId)} color="error">Deny</Button>
                                                    <Button onClick={() => socketRef.current.emit('admit-user', roomPath, user.socketId)} color="primary" variant="contained">Admit</Button>
                                                </div>
                                            </div>
                                        ))}
                                        <Divider sx={{ my: 2, borderColor: '#5f6368' }} />
                                    </>
                                )}
                                <h4>In the meeting</h4>
                                <List>
                                    <ListItem><ListItemText primary={`${username || "Guest"} (You)`} /></ListItem>
                                    {videos.map(v => (<ListItem key={v.socketId}><ListItemText primary={v.username || "Guest"} /></ListItem>))}
                                </List>
                            </div>
                        )}
                        {sidebarTab === 'controls' && isHost && (
                            <div style={{ padding: '20px' }}>
                                <h3>Host controls</h3>
                                <p style={{ fontSize: '14px', color: '#9aa0a6' }}>Use these host settings to keep control of your meeting.</p>
                                <Divider sx={{ my: 2, borderColor: '#5f6368' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Turn on their microphone</span>
                                    <Switch checked={hostSettings.allowMic} onChange={(e) => { const s = { ...hostSettings, allowMic: e.target.checked }; setHostSettings(s); socketRef.current.emit("update-host-settings", roomPath, s); }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                    <span>Turn on their video</span>
                                    <Switch checked={hostSettings.allowVideo} onChange={(e) => { const s = { ...hostSettings, allowVideo: e.target.checked }; setHostSettings(s); socketRef.current.emit("update-host-settings", roomPath, s); }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                    <span>Share their screen</span>
                                    <Switch checked={hostSettings.allowScreen} onChange={(e) => { const s = { ...hostSettings, allowScreen: e.target.checked }; setHostSettings(s); socketRef.current.emit("update-host-settings", roomPath, s); }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                    <span>Send chat messages</span>
                                    <Switch checked={hostSettings.allowChat} onChange={(e) => { const s = { ...hostSettings, allowChat: e.target.checked }; setHostSettings(s); socketRef.current.emit("update-host-settings", roomPath, s); }} />
                                </div>
                            </div>
                        )}
                    </Drawer>

                    <Dialog open={showEndCallDialog} onClose={() => setShowEndCallDialog(false)} PaperProps={{ sx: { borderRadius: '8px', padding: '10px', maxWidth: '400px' } }}>
                        <DialogTitle sx={{ fontWeight: '500', fontSize: '1.2rem', color: '#202124' }}>End the call or just leave?</DialogTitle>
                        <DialogContent>
                            <Typography sx={{ color: '#5f6368', fontSize: '0.95rem' }}>You can just leave the call if you don't want to end it for everyone else</Typography>
                        </DialogContent>
                        <DialogActions sx={{ padding: '8px 24px 16px 24px', justifyContent: 'space-between' }}>
                            <Button onClick={() => { setShowEndCallDialog(false); executeLeaveCall(); }} sx={{ color: '#0b57d0', textTransform: 'none', fontWeight: '500' }}>Just leave the call</Button>
                            <Button onClick={() => { setShowEndCallDialog(false); executeEndCallForAll(); }} variant="contained" disableElevation sx={{ backgroundColor: '#f8fafd', color: '#0b57d0', textTransform: 'none', fontWeight: '500', borderRadius: '20px', '&:hover': { backgroundColor: '#d3e3fd' } }}>End the call for everyone</Button>
                        </DialogActions>
                    </Dialog>
                </div>
            )}
        </div>
    );
}