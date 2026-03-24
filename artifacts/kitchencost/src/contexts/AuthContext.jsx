import React, { useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  updateProfile,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getRestaurantByUserId, getMember, deleteAllTenantData } from '../lib/firestore';
import { AuthContext } from './authContext';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [memberRole, setMemberRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const currency = restaurant?.currency || 'BRL';

  const isOwner = memberRole === 'owner';
  const isAdmin = memberRole === 'owner' || memberRole === 'admin';
  const isManager = memberRole === 'owner' || memberRole === 'admin' || memberRole === 'manager';
  const canOperate = !!memberRole;

  const loadRestaurant = useCallback(async (uid) => {
    try {
      const r = await getRestaurantByUserId(uid);
      setRestaurant(r);
      if (r?.id || r?.restaurantId) {
        const rid = r.id || r.restaurantId;
        const member = await getMember(rid, uid);
        setMemberRole(member?.role || null);
      } else {
        setMemberRole(null);
      }
    } catch {
      setRestaurant(null);
      setMemberRole(null);
    }
  }, []);

  // Safety net for mobile browsers:
  // When signInWithPopup is called on iOS/Android, the Firebase SDK automatically
  // falls back to a redirect flow because mobile browsers block popups.
  // getRedirectResult() recovers the user session when the browser returns to the app.
  // On desktop this resolves immediately with null — no side effects.
  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      // Ignore — errors here are non-actionable (e.g. no pending redirect).
      // onAuthStateChanged handles the authenticated state regardless.
      console.warn('[Auth] getRedirectResult:', error?.code);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadRestaurant(firebaseUser.uid);
      } else {
        setRestaurant(null);
        setMemberRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [loadRestaurant]);

  const loginWithEmail = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const registerWithEmail = async (email, password, name) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    return cred.user;
  };

  // Primary: signInWithPopup (desktop and iframe environments).
  // On mobile browsers that block popups, Firebase SDK automatically falls back
  // to signInWithRedirect internally — getRedirectResult() above handles the return.
  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setRestaurant(null);
    setMemberRole(null);
  };

  // Reauthenticate, delete all tenant data from Firestore, then delete the Firebase Auth user.
  const deleteAccount = async ({ email, password } = {}) => {
    if (!user) throw new Error('Utilizador não autenticado.');

    const providerId = user.providerData?.[0]?.providerId;

    // Reauthenticate before any destructive action
    if (providerId === 'google.com') {
      await reauthenticateWithPopup(user, googleProvider);
    } else {
      if (!email || !password) throw new Error('Email e senha são obrigatórios para confirmar a exclusão.');
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);
    }

    // Delete all Firestore tenant data
    const rid = restaurant?.restaurantId || restaurant?.id;
    if (rid) {
      await deleteAllTenantData(rid, user.uid);
    }

    // Delete Firebase Auth account
    await deleteUser(user);

    // Clear local state
    setUser(null);
    setRestaurant(null);
    setMemberRole(null);
  };

  const updateRestaurant = (data) => {
    setRestaurant(prev => ({ ...prev, ...data }));
  };

  const refreshRestaurant = async () => {
    if (user) await loadRestaurant(user.uid);
  };

  return (
    <AuthContext.Provider value={{
      user,
      restaurant,
      currency,
      loading,
      memberRole,
      isOwner,
      isAdmin,
      isManager,
      canOperate,
      isAuthenticated: !!user,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      logout,
      deleteAccount,
      updateRestaurant,
      refreshRestaurant,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
