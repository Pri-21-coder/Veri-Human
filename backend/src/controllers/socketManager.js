import { Server } from "socket.io";
import { Meeting } from "../models/meeting.model.js";
let connections = {};
let messages = {};
let timeOnline = {};
let userNames = {};
let roomHosts = {}; 
let waitingRooms = {}; 
let roomSettings = {};
export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });
    //connect with socket
    io.on("connection", (socket) => {
        console.log("Something Connected");
        //on means something emit from client side, 
        // it emits something in server to listen in client side we use .on
        socket.on("join-call", async (path, username, userId) => {
            if (connections[path] === undefined) {
                connections[path] = [];
            }
            if (waitingRooms[path] === undefined) {
                waitingRooms[path] = [];
            }
            if (roomSettings[path] === undefined) {
                roomSettings[path] = { allowMic: true, allowVideo: true, allowScreen: true, allowChat: true };
            }
            userNames[socket.id] = username;
            timeOnline[socket.id] = new Date();

            let role = "guest";
            const meetingCode = path.split('/').pop();
            if (userId) {
                const originalMeeting = await Meeting.findOne({ meetingCode: meetingCode }).sort({ date: 1 });
                if (originalMeeting && originalMeeting.user_id === userId) {
                    role = "host";
                }
            }
            if (role === "guest" && !roomHosts[path]) {
                role = "host";
            }
            if (role === "host") {
                roomHosts[path] = socket.id;
            }
            socket.emit("role-assignment", role);
            if (role === "guest") {
                // Guests are pushed to the waiting room
                waitingRooms[path].push({ socketId: socket.id, username });
                // Ping the active host to show the admit/deny UI
                if (roomHosts[path]) {
                    io.to(roomHosts[path]).emit("user-waiting", waitingRooms[path]);
                }
                socket.emit("wait-for-host");
                return; 
            }
            // Host gets admitted automatically
            admitUser(path, socket.id, username, io, socket);
            // If the host just joined and there are people waiting, update their UI
            if (role === "host" && waitingRooms[path].length > 0) {
                socket.emit("user-waiting", waitingRooms[path]);
            }
        });
        socket.on("admit-user", (path, targetSocketId) => {
            if (roomHosts[path] === socket.id) {
                waitingRooms[path] = waitingRooms[path].filter(u => u.socketId !== targetSocketId);   
                const targetSocket = io.sockets.sockets.get(targetSocketId);
                if (targetSocket) {
                    admitUser(path, targetSocketId, userNames[targetSocketId], io, targetSocket);
                } 
                io.to(targetSocketId).emit("admitted", roomSettings[path]);
                socket.emit("user-waiting", waitingRooms[path]);
            }
        });
        socket.on("deny-user", (path, targetSocketId) => {
            if (roomHosts[path] === socket.id) {
                waitingRooms[path] = waitingRooms[path].filter(u => u.socketId !== targetSocketId);
                io.to(targetSocketId).emit("denied");
                socket.emit("user-waiting", waitingRooms[path]);
            }
        });
        socket.on("update-host-settings", (path, settings) => {
            if (roomHosts[path] === socket.id) {
                roomSettings[path] = settings;
                socket.broadcast.to(path).emit("host-settings-updated", settings);
            }
        });
        socket.on("end-meeting-for-all", (path) => {
            if (roomHosts[path] === socket.id) {
                if (connections[path]) {
                    connections[path].forEach((peerId) => {
                        if (peerId !== socket.id) {
                            io.to(peerId).emit("meeting-ended-by-host");
                        }
                    });
                }               
                delete connections[path];
                delete roomHosts[path];
                delete roomSettings[path];
                delete waitingRooms[path];
                delete messages[path];
            }
        });
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });
        socket.on("media-status-change", (data) => {
            const matchingRoom = Object.keys(connections).find(room => 
                connections[room].includes(socket.id)
            );
            if (matchingRoom) {
                connections[matchingRoom].forEach((peerId) => {
                    if (peerId !== socket.id) {
                        io.to(peerId).emit("media-status-change", {
                            socketId: socket.id,
                            trackType: data.trackType,
                            enabled: data.enabled
                        });
                    }
                });
            }
        });
        socket.on("hand-status-change", (data) => {
            const matchingRoom = Object.keys(connections).find(room => 
                connections[room].includes(socket.id)
            );
            if (matchingRoom) {
                connections[matchingRoom].forEach((peerId) => {
                    if (peerId !== socket.id) {
                        io.to(peerId).emit("hand-status-change", {
                            socketId: socket.id,
                            raised: data.raised
                        });
                    }
                });
            }
        });
        socket.on("send-emoji", (data) => {
            const matchingRoom = Object.keys(connections).find(room => 
                connections[room].includes(socket.id)
            );
            if (matchingRoom) {
                socket.broadcast.to(matchingRoom).emit("receive-emoji", data);
            }
        });
        socket.on("mute-all", () => {
            const room = Object.keys(connections).find(r => connections[r].includes(socket.id));
            if (room && roomHosts[room] === socket.id) {
                socket.broadcast.to(room).emit("force-mute");
            }
        });
        socket.on("kick-user", (targetSocketId) => {
            const room = Object.keys(connections).find(r => connections[r].includes(socket.id));
            if (room && roomHosts[room] === socket.id) {
                io.to(targetSocketId).emit("kicked");
            }
        });
        socket.on("toggle-screen-share-lock", (isLocked) => {
            const room = Object.keys(connections).find(r => connections[r].includes(socket.id));
            if (room && roomHosts[room] === socket.id) {
                socket.broadcast.to(room).emit("screen-share-lock-updated", isLocked);
            }
        });
        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections)
            .reduce(([room, isFound], [roomKey, roomValue]) => {
                if (!isFound && roomValue.includes(socket.id)) {
                    return [roomKey, true];
                }
                return [room, isFound];
            }, ['', false]);

            if (found && (roomSettings[matchingRoom]?.allowChat !== false)) {
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = [];
                }
                connections[matchingRoom].forEach((elem) => {
                    io.to(elem).emit("chat-message", data, sender, socket.id);
                });
            }
        });
        socket.on("disconnect", () => {
            var key;
            for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
                for (let a = 0; a < v.length; ++a) {
                    if (v[a] === socket.id) {
                        key = k;
                        for (let i = 0; i < connections[key].length; ++i) {
                            io.to(connections[key][i]).emit('user-left', socket.id);
                        }
                        var index = connections[key].indexOf(socket.id);
                        connections[key].splice(index, 1);
                        
                        if (roomHosts[key] === socket.id) {
                            roomHosts[key] = null;
                        }
                        
                        if (connections[key].length === 0) {
                            delete connections[key];
                            delete roomHosts[key];
                            delete roomSettings[key];
                            delete waitingRooms[key];
                            delete messages[key];
                        }
                    }
                }
            }
        });
    });
    return io;
};
// Helper function to initialize WebRTC channels
function admitUser(path, socketId, username, io, socket) {
    if (!connections[path]) {
        connections[path] = [];
    }
    
    if (!connections[path].includes(socketId)) {
        connections[path].push(socketId);
    }
    
    if (socket) {
        socket.join(path);
    }
    
    const currentRoomUsers = connections[path].map(id => ({
        socketId: id,
        username: userNames[id] || "Guest"
    }));
    
    io.to(socketId).emit("get-existing-users", currentRoomUsers);
    
    connections[path].forEach((peerId) => {
        if (peerId !== socketId) {
            io.to(peerId).emit("user-joined", socketId, username);
        }
    });
}