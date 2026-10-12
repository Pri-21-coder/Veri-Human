import React from 'react'
import "../styles/landing.css"
import { Link, useNavigate } from 'react-router-dom';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';

export default function LandingPage() {
    const router = useNavigate();
    return (
        <div className='landingPageContainer'>
            <nav>
                <div className='navHeader'>
                    <img src="/logo.png" alt="VeriHuman logo" />
                    <p>Veri-Human</p>
                </div>
                <div className='navlist'>
                    <p onClick={() => router("/auth")}>Register</p>
                    <p onClick={() => router("/auth")}>Login</p>
                    <p onClick={() => router("/ab234dc")}>Join as Guest</p>
                </div>
            </nav>

            <div className="landingMainContainer">
                <div>
                    <h1><span className="veri">veri</span><span className="human">human</span></h1>
                    <p>
                        Experience crystal-clear, high-quality video meetings built for everyone.
                        Connect with total confidence on a completely secure platform.
                    </p>
                    <div role='button'>
                        <Link to={"/auth"}>Get Started</Link>
                    </div>
                </div>
                <div>
                    <img src="/landing.svg" alt="" />
                </div>
            </div>
        </div>
    )
}