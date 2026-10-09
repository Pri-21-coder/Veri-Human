import './App.css';
import {Route, BrowserRouter as Router, Routes} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeetComponent from './pages/VideoMeet';
import Authentication from './pages/authentication';
function App() {
  return (
    <>
      <Router>
        <AuthProvider>
        <Routes>
          <Route path='/:auth' element={<Authentication/>}/>
          <Route path="/:url" element={<VideoMeetComponent/>}/>
        </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;