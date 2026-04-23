import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PhoneOff, Share2, Mic, MicOff, Video, VideoOff, Maximize, AlertCircle, Phone } from 'lucide-react';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Peer, { MediaConnection } from 'peerjs';
import { toast } from 'sonner';

// Custom Video Player component that renders the MediaStream directly
const VideoPlayer = ({ stream, isLocal = false }: { stream: MediaStream | null, isLocal?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal} // always mute local audio to prevent screeching echo
      className={`w-full h-full object-cover bg-black ${isLocal ? 'scale-x-[-1]' : ''}`}
    />
  );
};

export default function Call() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const searchParams = new URLSearchParams(location.search);
  const callMode = searchParams.get('mode') || 'video'; // 'audio' or 'video'
  const isAudioOnlyCall = callMode === 'audio';

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(isAudioOnlyCall);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const callsRef = useRef<Record<string, MediaConnection>>({});

  const cleanId = (chatId || 'Meeting').replace(/[^a-zA-Z0-9]/g, '');
  const roomName = `NexusRoom_${cleanId}`;

  // Start Hardware WebRTC
  useEffect(() => {
    if (!user) {
      navigate('/messages');
      return;
    }

    let currentStream: MediaStream;
    let myPeerId: string;

    const startCall = async () => {
      try {
        // Native browser API request - bypasses all 3rd party restrictions
        const constraints = {
          audio: true,
          video: isAudioOnlyCall ? false : true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        currentStream = stream;

        // Initialize PeerJS public signaling
        const peer = new Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });
        peerRef.current = peer;

        peer.on('error', async (err: any) => {
          if (err.type === 'peer-unavailable') {
            const idMatch = err.message.match(/peer ([a-zA-Z0-9-]+)/);
            if (idMatch && idMatch[1]) {
              const unavailableId = idMatch[1];
              try {
                const callDocRef = doc(db, 'callRooms', roomName);
                const snap = await getDoc(callDocRef);
                if (snap.exists()) {
                  const activeUsers = snap.data().activeUsers || {};
                  const userIdToRemove = Object.keys(activeUsers).find(key => activeUsers[key] === unavailableId);
                  if (userIdToRemove) {
                    const { deleteField } = await import('firebase/firestore');
                    await updateDoc(callDocRef, { [`activeUsers.${userIdToRemove}`]: deleteField() });
                  }
                }
              } catch (e) {}
            }
          } else {
            console.error("PeerJS Error:", err);
          }
        });

        // Upon connecting to signaling server
        peer.on('open', async (id) => {
          myPeerId = id;
          const callDocRef = doc(db, 'callRooms', roomName);
          
          // Use a map instead of an array to ensure ONE peerId max per UserId
          const snap = await getDoc(callDocRef);
          if (!snap.exists()) {
            await setDoc(callDocRef, { activeUsers: { [user.uid]: id } });
          } else {
            const data = snap.data();
            const currentUsers = data.activeUsers || {};
            await updateDoc(callDocRef, { activeUsers: { ...currentUsers, [user.uid]: id } });
          }
        });

        // Listen for INCOMING calls
        peer.on('call', (call) => {
          // Reject calls from ourselves (ghost tabs)
          if (call.metadata?.userId === user.uid) {
            call.close();
            return;
          }

          call.answer(stream); // answer with our stream
          call.on('stream', (remoteStream) => {
            // Ensure we don't duplicate
            setPeers(prev => prev[call.peer] ? prev : { ...prev, [call.peer]: remoteStream });
          });
          call.on('close', () => {
            setPeers(prev => {
              if (!prev[call.peer]) return prev;
              const newPeers = { ...prev };
              delete newPeers[call.peer];
              return newPeers;
            });
            delete callsRef.current[call.peer];
          });
          callsRef.current[call.peer] = call;
        });

        // Listen to Firestore for other peers in the room
        const unsubStore = onSnapshot(doc(db, 'callRooms', roomName), (snapshot) => {
          const data = snapshot.data();
          if (data && data.activeUsers) {
            const activePeerIds = Object.values(data.activeUsers) as string[];
            
            // Cleanup closed calls
            setPeers(prev => {
              const newPeers = { ...prev };
              let changed = false;
              Object.keys(newPeers).forEach(id => {
                if (!activePeerIds.includes(id)) {
                  delete newPeers[id];
                  changed = true;
                  const c = callsRef.current[id];
                  if (c) {
                    c.close();
                    delete callsRef.current[id];
                  }
                }
              });
              return changed ? newPeers : prev;
            });

            // Connect to NEW participants
            Object.entries(data.activeUsers).forEach(([userId, peerId]) => {
              if (typeof peerId === 'string' && peerId !== peer.id && peerId !== myPeerId && !callsRef.current[peerId] && userId !== user.uid) {
                const call = peer.call(peerId, stream, { metadata: { userId: user.uid } });
                callsRef.current[peerId] = call;
                
                call.on('stream', (remoteStream) => {
                  setPeers(prev => prev[peerId] ? prev : { ...prev, [peerId]: remoteStream });
                });
                
                call.on('close', () => {
                  setPeers(prev => {
                    if (!prev[peerId]) return prev;
                    const newPeers = { ...prev };
                    delete newPeers[peerId];
                    return newPeers;
                  });
                  delete callsRef.current[peerId];
                });

                call.on('error', (err) => {
                  console.error('Call error', err);
                });
              }
            });
          }
        });

        // Store unsub so we can call it on unmount
        (peer as any)._unsubFirestore = unsubStore;

      } catch (err: any) {
        console.error("Media Access Error:", err);
        setCameraError(err.message || "Failed to access camera/microphone.");
      }
    };

    startCall();

    return () => {
      // Cleanup
      if (myPeerId) {
        import('firebase/firestore').then(({ deleteField }) => {
          const callDocRef = doc(db, 'callRooms', roomName);
          updateDoc(callDocRef, { [`activeUsers.${user.uid}`]: deleteField() }).catch(e => console.log(e));
        });
      }
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        if ((peerRef.current as any)._unsubFirestore) {
          (peerRef.current as any)._unsubFirestore();
        }
        
        Object.values(callsRef.current).forEach(c => c.close());
        peerRef.current.destroy();
      }
    };
  }, [user, navigate, roomName, isAudioOnlyCall]);

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = async () => {
    if (isAudioOnlyCall) {
      // Cannot turn on video in an audio-only call yet without renegotiating WebRTC tracks
      toast.info("This is an audio-only room. Please hang up and start a Video Call if you'd like to use video.");
      return;
    }

    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleEndCall = () => {
    navigate(-1);
  };

  const peerIds = Object.keys(peers);
  const hasPeers = peerIds.length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col font-sans">
      
      {/* Header */}
      <div className="h-16 shrink-0 border-b border-zinc-900 bg-zinc-950 flex items-center justify-between px-4 z-50">
        <h2 className="text-white font-bold flex items-center gap-2">
          {cameraError ? (
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.7)]"></span>
          )}
          {isAudioOnlyCall ? "Active Voice Call" : (hasPeers ? 'Active Video Call' : 'Connecting Room')}
        </h2>
        <div className="flex items-center gap-2 md:gap-3">
          {cameraError && (
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2 text-xs md:text-sm font-semibold"
            >
              <Maximize className="w-4 h-4" />
              Open Browser Native
            </button>
          )}
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Meeting link copied!');
            }}
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Media Viewport area */}
      <div className="flex-1 w-full bg-black relative overflow-hidden">

        {cameraError && !localStream ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-xl text-white font-bold mb-2">Permission Blocked</h3>
            <p className="text-zinc-400 mb-6 max-w-sm">
              We couldn't access your {isAudioOnlyCall ? 'microphone' : 'camera/microphone'}. 
              Please check site permissions or try clicking "Open Browser Native" on Android WebViews.
            </p>
          </div>
        ) : (
          <>
            {isAudioOnlyCall ? (
               // AUDIO CALL UI Layout
               <div className="flex-1 h-full bg-zinc-900 flex flex-col items-center justify-center relative">
                  {/* Invisible audio playing */}
                  {peerIds.map(id => (
                    <div key={id} className="hidden"><VideoPlayer stream={peers[id]} /></div>
                  ))}
                  
                  {/* Visualizer avatars for Audio Calls */}
                  <div className="flex flex-wrap items-center justify-center gap-8 mb-20 px-8">
                     {/* Local Avatar */}
                     <div className="flex flex-col items-center gap-4">
                        <div className={`w-32 h-32 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.3)] transition-all ${!isMuted ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}`}>
                           <p className="text-4xl font-bold text-white">You</p>
                        </div>
                        {isMuted && <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold">Muted</div>}
                     </div>
                     
                     {/* Remote Avatars */}
                     {peerIds.map(id => (
                        <div key={id} className="flex flex-col items-center gap-4">
                          <div className="w-32 h-32 rounded-full bg-zinc-800 flex items-center justify-center shadow-xl">
                             <Phone className="w-10 h-10 text-indigo-400 opacity-50" />
                          </div>
                          <p className="text-zinc-400 font-medium">Participant</p>
                        </div>
                     ))}
                     
                     {!hasPeers && (
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center">
                          <p className="text-zinc-400 animate-pulse">Waiting for others to join...</p>
                        </div>
                     )}
                  </div>
               </div>
            ) : (
               // VIDEO CALL UI Layout
               <>
                 {hasPeers ? (
                    peerIds.length === 1 ? (
                       // WhatsApp 1-on-1 Layout
                       <>
                          <div className="absolute inset-0">
                              <VideoPlayer stream={peers[peerIds[0]]} />
                          </div>
                          <div className="absolute top-4 right-4 w-28 h-40 md:w-40 md:h-56 z-20 shadow-2xl overflow-hidden rounded-2xl border-2 border-zinc-700 bg-zinc-900 transition-all hover:scale-105 active:scale-95 cursor-move">
                              <div className={`${isVideoOff ? 'hidden' : 'block'} w-full h-full`}>
                                <VideoPlayer stream={localStream} isLocal />
                              </div>
                              {isVideoOff && (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900">
                                  <VideoOff className="w-8 h-8 text-zinc-600" />
                                </div>
                              )}
                          </div>
                       </>
                    ) : (
                      // Facebook/Zoom Format for Multiple Video Streams
                      <div className="w-full h-full overflow-y-auto pb-24 px-2 pt-2 custom-scrollbar">
                        <div className={`grid gap-2 ${
                          peerIds.length + 1 <= 4 ? 'grid-cols-2 auto-rows-[45vh]' : 
                          peerIds.length + 1 <= 9 ? 'grid-cols-3 auto-rows-[30vh]' : 
                          'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 auto-rows-[25vh]'
                        }`}>
                           {/* Remote Streams */}
                           {peerIds.map(id => (
                             <div key={id} className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-lg">
                               <VideoPlayer stream={peers[id]} />
                               <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-xs backdrop-blur font-medium">Participant</div>
                             </div>
                           ))}
                           {/* Local Stream included in the grid */}
                           <div className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                             <div className={`${isVideoOff ? 'hidden' : 'block'} w-full h-full`}>
                               <VideoPlayer stream={localStream} isLocal />
                             </div>
                             {isVideoOff && (
                               <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                 <VideoOff className="w-12 h-12 text-zinc-600" />
                               </div>
                             )}
                             <div className="absolute bottom-2 left-2 bg-indigo-500/80 px-2 py-1 rounded text-white text-xs backdrop-blur font-bold">You</div>
                           </div>
                        </div>
                      </div>
                    )
                 ) : (
                    // Waiting Room Video UI
                    <div className="w-full h-full relative">
                       <div className={`${isVideoOff ? 'hidden' : 'block'} w-full h-full`}>
                         <VideoPlayer stream={localStream} isLocal />
                       </div>
                       {isVideoOff && (
                         <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center pb-20">
                           <VideoOff className="w-20 h-20 text-zinc-800 mb-6" />
                           <h3 className="text-2xl text-zinc-600 font-bold tracking-tight text-center">Camera disabled</h3>
                         </div>
                       )}
     
                       {!isVideoOff && (
                         <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm pointer-events-none pb-20">
                           <div className="bg-black/60 px-6 py-4 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center">
                             <div className="flex gap-2 mb-3">
                               <span className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay: '0s'}}></span>
                               <span className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay: '0.2s'}}></span>
                               <span className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce" style={{animationDelay: '0.4s'}}></span>
                             </div>
                             <h3 className="text-xl text-white font-medium text-center">Waiting for others...</h3>
                           </div>
                         </div>
                       )}
                    </div>
                 )}
               </>
            )}
          </>
        )}

        {/* WhatsApp-Style Floating Universal Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 md:gap-6 px-6 py-4 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-3xl z-50 transition-all">
           
           {/* Mute Button */}
           <button 
             onClick={toggleMute}
             className={`p-4 rounded-full transition-all active:scale-95 ${isMuted ? 'bg-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
           >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
           </button>
           
           {/* Hangup Button (Center, Red) */}
           <button 
             onClick={handleEndCall}
             className="p-5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-all shadow-[0_4px_20px_rgba(239,68,68,0.4)] hover:shadow-[0_4px_25px_rgba(239,68,68,0.6)] active:scale-90"
           >
              <PhoneOff className="w-7 h-7" />
           </button>
           
           {/* Video Toggle Button (Only on video calls, but disabled/invisible on pure audio) */}
           {!isAudioOnlyCall && (
             <button 
               onClick={toggleVideo}
               className={`p-4 rounded-full transition-all active:scale-95 ${isVideoOff ? 'bg-zinc-200 text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
             >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
             </button>
           )}
           
        </div>

      </div>
    </div>
  );
}
