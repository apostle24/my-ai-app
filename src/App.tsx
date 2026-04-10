/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import AIStudio from "./pages/AIStudio";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import CreatorDashboard from "./pages/CreatorDashboard";
import Marketplace from "./pages/Marketplace";
import PostDetail from "./pages/PostDetail";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import AdminDashboard from "./pages/AdminDashboard";
import { AuthProvider } from "./contexts/AuthContext";
import { Toaster } from 'sonner';
import { useEffect } from "react";
import { getDocFromServer, doc } from "firebase/firestore";
import { db } from "./firebase";

export default function App() {
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
        // Skip logging for other errors, as this is simply a connection test.
      }
    }
    testConnection();
  }, []);

  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="discover" element={<Discover />} />
            <Route path="ai-studio" element={<AIStudio />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="messages" element={<Messages />} />
            <Route path="chat" element={<Chat />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="profile/:userId?" element={<Profile />} />
            <Route path="creator-dashboard" element={<CreatorDashboard />} />
            <Route path="post/:postId" element={<PostDetail />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}
