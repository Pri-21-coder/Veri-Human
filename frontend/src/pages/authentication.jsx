import * as React from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar } from '@mui/material';
import "../App.css";

export default function Authentication() {
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");

    // 0 = Sign In, 1 = Sign Up
    const [formState, setFormState] = React.useState(1);
    const [open, setOpen] = React.useState(false);

    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    let handleAuth = async () => {
        try {
            if (formState === 0) {
                await handleLogin(username, password);
            }
            if (formState === 1) {
                let result = await handleRegister(name, username, password, email);
                console.log(result);
                setUsername("");
                setMessage(result || "User registered successfully!");
                setOpen(true);
                setError("");
                setFormState(0);
                setPassword("");
                setName("");
                setEmail("");
            }
        } catch (err) {
            console.log(err);
            let errMsg = err?.response?.data?.message || err?.message || "Authentication failed";
            setError(errMsg);
        }
    };

    return (
        <div className="authContainer">
            <div className="authMainWrapper">
                {/* Left Side: Video Conference Illustration from public/image 3.png */}
                <div className="authHeroSection">
                    <div className="videoConferenceWindow">
                        <img
                            src="/image%203.png"
                            alt="Video Conference"
                            className="authHeroImage"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "/image3.png";
                            }}
                        />
                    </div>
                </div>

                {/* Right Side: Form Section */}
                <div className="authCardSection">
                    <div className="authCard">
                        {/* Video Camera Icon Badge */}
                        <div className="authCameraBadge">
                            <svg viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="1" y="1" width="18" height="18" rx="4" stroke="#4cd964" strokeWidth="2.2" />
                                <path d="M19 6.5L26 2V18L19 13.5V6.5Z" stroke="#4cd964" strokeWidth="2.2" strokeLinejoin="round" />
                            </svg>
                        </div>

                        {/* Sign In / Sign Up Toggle Group */}
                        <div className="authToggleRow">
                            <button
                                type="button"
                                className={`authToggleBtn ${formState === 0 ? "active" : "inactive"}`}
                                onClick={() => {
                                    setFormState(0);
                                    setError("");
                                }}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                className={`authToggleBtn ${formState === 1 ? "active" : "inactive"}`}
                                onClick={() => {
                                    setFormState(1);
                                    setError("");
                                }}
                            >
                                Sign Up
                            </button>
                        </div>

                        {/* Social Login Buttons: Google & Microsoft Outlook */}
                        <div className="authSocialRow">
                            <button
                                type="button"
                                className="authSocialBtn"
                                title="Sign in with Google"
                                aria-label="Sign in with Google"
                            >
                                <img src="/g-logo.svg" alt="Google" className="authSocialIcon" />
                            </button>
                            <button
                                type="button"
                                className="authSocialBtn"
                                title="Sign in with Microsoft / Outlook account"
                                aria-label="Sign in with Microsoft / Outlook account"
                            >
                                <img src="/ms-outlook-logo.svg" alt="Microsoft Outlook" className="authSocialIcon" />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="authDivider">
                            <span>or</span>
                        </div>

                        {/* Input Fields */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleAuth();
                            }}
                            className="authForm"
                        >
                            {formState === 1 && (
                                <>
                                    <div className="authInputGroup">
                                        <input
                                            type="text"
                                            className="authInput"
                                            placeholder="Full Name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="authInputGroup">
                                        <input
                                            type="email"
                                            className="authInput"
                                            placeholder="Enter your email address"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <div className="authInputGroup">
                                <input
                                    type={formState === 0 ? "email" : "text"}
                                    className="authInput"
                                    placeholder={formState === 0 ? "Email address" : "Username"}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="authInputGroup">
                                <input
                                    type="password"
                                    className="authInput"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {error && <p className="authError">{error}</p>}

                            {/* Submit Button aligned right */}
                            <div className="authActionRow">
                                <button
                                    type="submit"
                                    className="authActionBtn"
                                >
                                    {formState === 0 ? "Login" : "Register"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <Snackbar
                open={open}
                autoHideDuration={4000}
                onClose={() => setOpen(false)}
                message={message}
            />
        </div>
    );
}