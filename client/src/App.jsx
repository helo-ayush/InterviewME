import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Interview from './routes/Interview';
import Landing from './routes/Landing';
import Home from './routes/Home';
import Layout from './routes/Layout';
import Profile from './routes/Profile';
import Pricing from './routes/Pricing';

// Interview flow subcomponents
import InterviewWelcome from './components/interview/InterviewWelcome';
import PermissionRequest from './components/interview/PermissionRequest';
import InterviewBooting from './components/interview/InterviewBooting';
import InterviewSession from './components/interview/InterviewSession';
import InterviewComplete from './components/interview/InterviewComplete';

// Redirect signed-in users away from the landing page
const LandingGuard = () => {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null; // wait for Clerk to load
  if (isSignedIn) return <Navigate to="/home" replace />;

  return <Landing />;
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<LandingGuard />} />
        <Route path="/home" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path='interview' element={<Interview />}>
            <Route index element={<InterviewWelcome />} />
            <Route path='permissions' element={<PermissionRequest />} />
            <Route path='booting' element={<InterviewBooting />} />
            <Route path='session' element={<InterviewSession />} />
            <Route path='complete' element={<InterviewComplete />} />
          </Route>
          <Route path='profile' element={<Profile />} />
          <Route path='pricing' element={<Pricing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;