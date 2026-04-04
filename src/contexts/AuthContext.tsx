import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAppStore } from '../store';
import { subscribeToPushNotifications } from '../utils/pushNotifications';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, userProfile, setUser, setUserProfile } = useAppStore();

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            const newProfile: any = {
              uid: currentUser.uid,
              role: 'user',
              createdAt: new Date().toISOString(),
              walletBalance: 0,
              credits: 5,
              isPro: false,
              isCreator: false,
              onboarded: false,
              username: currentUser.email ? currentUser.email.split('@')[0] : `user_${Math.floor(Math.random() * 10000)}`,
            };
            if (currentUser.email) newProfile.email = currentUser.email;
            if (currentUser.displayName) newProfile.displayName = currentUser.displayName;
            if (currentUser.photoURL) newProfile.photoURL = currentUser.photoURL;
            
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          } else {
            const data = userDoc.data() as any;
            let needsUpdate = false;
            const updates: any = {};

            if (data.credits === undefined) {
              data.credits = 5;
              updates.credits = 5;
              needsUpdate = true;
            }
            if (data.isPro === undefined) {
              data.isPro = false;
              updates.isPro = false;
              needsUpdate = true;
            }
            if (data.walletBalance === undefined) {
              data.walletBalance = 0;
              updates.walletBalance = 0;
              needsUpdate = true;
            }
            if (data.isCreator === undefined) {
              data.isCreator = false;
              updates.isCreator = false;
              needsUpdate = true;
            }
            if (data.role === undefined) {
              data.role = 'user';
              updates.role = 'user';
              needsUpdate = true;
            }
            if (data.onboarded === undefined) {
              data.onboarded = false;
              updates.onboarded = false;
              needsUpdate = true;
            }
            if (data.uid === undefined) {
              data.uid = currentUser.uid;
              updates.uid = currentUser.uid;
              needsUpdate = true;
            }
            if (data.email === undefined && currentUser.email) {
              data.email = currentUser.email;
              updates.email = currentUser.email;
              needsUpdate = true;
            }
            if (data.createdAt === undefined) {
              data.createdAt = new Date().toISOString();
              updates.createdAt = data.createdAt;
              needsUpdate = true;
            }

            if (needsUpdate) {
              await setDoc(userDocRef, updates, { merge: true });
            }
            setUserProfile({ ...data, ...updates });
          }

          // Subscribe to push notifications
          subscribeToPushNotifications(currentUser.uid);

          // Listen for profile changes
          if (unsubProfile) unsubProfile();
          unsubProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data() as any);
            }
          });

          setLoading(false);

        } catch (err: any) {
          console.error("Error fetching/creating user profile:", err);
          setError(err.message || "Error fetching profile");
          setLoading(false);
        }
      } else {
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = undefined;
        }
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, [setUser, setUserProfile]);

  const signInWithGoogle = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Error signing in with Google", err);
      setError(err.message || "Failed to sign in with Google");
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Error signing in with email", err);
      setError(err.message || "Failed to sign in with email");
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Error signing up with email", err);
      setError(err.message || "Failed to sign up with email");
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      console.error("Error signing out", err);
      setError(err.message || "Failed to sign out");
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, error, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
