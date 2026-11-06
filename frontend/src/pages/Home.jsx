import React, { useContext, useState } from 'react'
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import { Button, InputAdornment, TextField } from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { AuthContext } from "../contexts/AuthContext";
import "../styles/home.css"

//this component not accesible by everyone Authenticate user can access this
function HomeComponent(){
    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const {addToUserHistory} = useContext(AuthContext);
    let handleJoinVideoCall = async ()=> {
        await addToUserHistory(meetingCode);
        navigate(`/${meetingCode}`)
    }
    return (
        <>
        <div className='Page'>
        <div className="navBar">
            <div className='navbarLogo'>
                <img src="/logo.png" alt="VeriHuman logo" />
                <h2>Veri-Human</h2>
            </div>
            <div className='navbarList'>
                <p onClick={
                    ()=>{
                        navigate("/history")
                    }
                }>History</p>
                <p onClick={()=>{
                    localStorage.removeItem("token")
                    navigate("/auth")
                }}>
                    Logout
                </p>
            </div>
        </div>
        <div className="meetContainer">
            <div className="leftPanel">
                <div>
                    <div><h2>Bring people together. Let ideas take shape. Step in. Connect. Make it happen.</h2></div>
                    <div className='join'>
                        <TextField
                            onChange={e => setMeetingCode(e.target.value)}
                            placeholder="Meeting Code"
                            variant="outlined"
                            InputProps={{
                                startAornment: (
                                    <InputAdornment position="start">
                                        <KeyboardIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>
                    </div>
                </div>
            </div>
            <div className="rightPanel">
                <img srcSet="/home.svg" alt="" />
            </div>
        </div>
        </div>
        </>
    )
}

export default withAuth(HomeComponent)