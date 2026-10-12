import axios from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";
import { supabase } from "../config/supabaseClient";

export const AuthContext = createContext({});

const client = axios.create({
  baseURL: `${server}/api/v1/users`,
});

export const AuthProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  const router = useNavigate();

  const syncWithBackend = async (token, additionalData = {}) => {
    try {
      const response = await client.post(
        "/sync",
        additionalData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Backend sync failed:", error);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem("token", session.access_token);
        setUserData(session.user);
        syncWithBackend(session.access_token);
        if (window.location.pathname === "/auth") {
          router("/home");
        }
      }
    });

    // Listen to auth changes (including OAuth redirects)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        localStorage.setItem("token", session.access_token);
        setUserData(session.user);
        await syncWithBackend(session.access_token);
        if (event === "SIGNED_IN" || window.location.pathname === "/auth") {
          router("/home");
        }
      } else {
        localStorage.removeItem("token");
        setUserData(null);
      }
    });


    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRegister = async (name, username, password, email) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            username,
          },
        },
      });

      if (error) throw error;

      if (data?.session?.access_token) {
        localStorage.setItem("token", data.session.access_token);
        setUserData(data.user);
        await syncWithBackend(data.session.access_token, {
          name,
          provider: "google",
        });
      }

      return "User registered successfully! Check email for confirmation if enabled.";
    } catch (err) {
      throw err;
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data?.session?.access_token) {
        localStorage.setItem("token", data.session.access_token);
        setUserData(data.user);
        await syncWithBackend(data.session.access_token, {
          name: data.user.user_metadata?.name,
        });
        router("/home");
      }
    } catch (err) {
      throw err;
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: provider === "azure" ? "email openid profile" : undefined,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Social login error:", err);
      throw err;
    }
  };



  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    setUserData(null);
    router("/auth");
  };

  const getHistoryOfUser = async () => {
    try {
      const token = localStorage.getItem("token");
      const request = await client.get("/get_all_activity", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return request.data;
    } catch (err) {
      throw err;
    }
  };

  const addToUserHistory = async (meetingCode) => {
    try {
      const token = localStorage.getItem("token");
      const request = await client.post(
        "/add_to_activity",
        {
          meeting_code: meetingCode,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return request;
    } catch (e) {
      throw e;
    }
  };

  const data = {
    userData,
    setUserData,
    addToUserHistory,
    getHistoryOfUser,
    handleRegister,
    handleLogin,
    handleSocialLogin,
    handleLogout,
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};