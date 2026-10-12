import './App.css';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeetComponent from './pages/VideoMeet';
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
import History from './pages/history';
function App() {
  return (
    <>
      <Router>
        <AuthProvider>
        <Routes>
          <Route path='/' element={<LandingPage/>}/>
          <Route path='/auth' element={<Authentication/>}/>
          <Route path='/history' element={<History/>}/>
          <Route path="/:url" element={<VideoMeetComponent/>}/>
        </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;
