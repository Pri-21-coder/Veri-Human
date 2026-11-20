import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../App.css';

export default function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const routeTo = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history || []);
            } catch (e) {
                console.log(e);
            }
        };
        fetchHistory();
    }, [getHistoryOfUser]);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        routeTo('/auth');
    };

    return (
        <div className="history-page">
            <header className="history-navbar">
                <div className="history-logo-container" onClick={() => routeTo('/home')}>
                    <img src="/logo.png" alt="Veri-Human" className="history-logo" />
                </div>
                <div className="history-nav-actions">
                    <button className="history-nav-btn" onClick={() => routeTo('/home')}>
                        Home
                    </button>
                    <button className="history-nav-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </header>

            <main className="history-main">
                <h1 className="history-title">History</h1>

                <div className="history-container">
                    {meetings && meetings.length > 0 ? (
                        meetings.map((e, i) => (
                            <div key={i} className="history-pill-card">
                                <div className="history-pill-code">Code: {e.meetingCode}</div>
                                <div className="history-pill-date">Date: {formatDate(e.date)}</div>
                            </div>
                        ))
                    ) : (
                        <div className="no-history">No previous meetings</div>
                    )}
                </div>
            </main>
        </div>
    );
}