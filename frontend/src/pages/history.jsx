import React, { useContext, useEffect, useState } from 'react'
import {AuthContext} from '../contexts/AuthContext';
import {useNavigate} from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';
import { IconButton } from '@mui/material';
export default function History() {
    const {getHistoryOfUser} = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const routeTo= useNavigate();
    useEffect(()=>{
        const fetchHistory = async ()=>{
            try{
                const history = await getHistoryOfUser();
                setMeetings(history);
            } catch(e){
                console.log(e);
            }
        }
        fetchHistory();

    }, [getHistoryOfUser])
    let formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2,"0");
        const month =  (date.getMonth()+1).toString().padStart(2,"0")
        const year = date.getFullYear();
        return `${day}/${month}/${year}`
    }
    return(
        <div className="page-wrapper">
            <div className="top-navbar">
                <IconButton onClick={() => {
                    routeTo("/home")
                }}>
                    <HomeIcon />
                </IconButton >
            </div>
           <div className="history-container">
           {
                (meetings.length !== 0) ? meetings.map((e, i) => {
                    return (
                        <Card key={i} variant="outlined" className="history-card">
                            <CardContent>
                                <Typography className="card-code" sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                                    Code: {e.meetingCode} 
                                 </Typography>

                                <Typography className="card-date" sx={{ mb: 1.5 }} color="text.secondary">
                                    Date: {formatDate(e.date)}
                                </Typography>
                            </CardContent>
                        </Card>
                    )
                }) :<div className="no-history">No meeting history found.</div>
            }
            </div> 
        </div>
    )
}