import {Server} from "socket.io";
let connections = {};
let messages = {};
let timeOnline = {};
let userNames = {};
export const connectToSocket =(server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });
    //connect with socket
    io.on("connection", (socket)=>{
        console.log("Something Connected")
        //on means something emit from client side, 
        // it emits something in server to listen in client side we use .on
        socket.on("join-call", (path,username)=>{
            if(connections[path] === undefined){
                connections[path]=[]
            }
            userNames[socket.id] = username;
            // one meeting id all the user (inn this way all meeting)
            connections[path].push(socket.id)
            //online time
            timeOnline[socket.id] = new Date();
            const currentRoomUsers = connections[path].map(id => ({
                socketId: id,
                username: userNames[id] || "Guest"
            }));
    
            socket.emit("get-existing-users", currentRoomUsers);
            //number of server/path
            connections[path].forEach((peerId) => {
                if (peerId !== socket.id) {
                    io.to(peerId).emit("user-joined", socket.id, username);
                }
            });
           /* if (messages[path] !== undefined){
                for(let a=0;a<messages[path].length; ++a){
                    io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                        messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
                }
            }*/
        })
        socket.on("signal", (toId, message)=> {
            io.to(toId).emit("signal", socket.id, message);
        })
        socket.on("media-status-change", (data) => {
            // 'data' contains {socketId, trackType, enabled}
            // We need to find the room the user is in to broadcast to others
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
        // chat message comes from client after press the enter
        socket.on("chat-message", (data,sender)=>{
            //find in which meeting room user are in
            const [matchingRoom, found]= Object.entries(connections)
            .reduce(([room, isFound], [roomKey, roomValue]) =>{
                if(!isFound && roomValue.includes(socket.id)){
                    return [roomKey, true];
                }
                return [room, isFound];
            }, ['', false]);
            if(found == true){
                if(messages[matchingRoom] === undefined){
                    messages[matchingRoom] = []
                }
                //messages[matchingRoom].push({'sender':sender, "data": data, "socket-id-sender":socket.id})
                console.log("message",matchingRoom, ":", sender, data)
                connections[matchingRoom].forEach((elem)=>{
                    io.to(elem).emit("chat-message", data, sender, socket.id)
                })
            }
        })
        socket.on("disconnect", ()=>{
            var diffTime = Math.abs(timeOnline[socket.id] - new Date())
            var key
            // k->room v->no of person
            for( const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))){
                // iterate with number of person in a meeting room
                for(let a = 0; a< v.length; ++a){
                    //if disconnect person id equal to current socket id
                    //that person would be emit user-left
                    if(v[a] === socket.id){
                        key = k
                        for (let a=0; a< connections[key].length; ++a){
                            io.to(connections[key][a]).emit('user-left', socket.id)
                        }
                        // detele the connection index
                        var index = connections[key].indexOf(socket.id)
                        connections[key].splice(index,1)
                        // if key 0 means room has no client then drop the meeting
                        if(connections[key].length == 0){
                            delete connections[key]
                        }
                    }
                }
            }
        })
    })
    return io;
}