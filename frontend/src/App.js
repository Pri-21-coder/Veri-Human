import './App.css';
import {Route, BrowserRouter as Router, Routes} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeetComponent from './pages/VideoMeet';
function App() {
  return (
    <>
      <Router>
        <AuthProvider>
        <Routes>
          <Route path="/:url" element={<VideoMeetComponent/>}/>
        </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;