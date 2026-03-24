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

  /**
   * Reauthenticates, deletes all Firestore tenant data, attempts to delete Cloudinary
   * files via the API server, then deletes the Firebase Auth account.
   *
   * Returns { cloudinaryDeleted: boolean, cloudinaryFileCount: number, cloudinaryOrphans: string[] }
   * so the caller can inform the user about the cleanup status.
   */
  const deleteAccount = async ({ email, password } = {}) => {
    if (!user) throw new Error('Utilizador não autenticado.');

    const providerId = user.providerData?.[0]?.providerId;

    // Step 1 — Reauthenticate before any destructive action
    if (providerId === 'google.com') {
      await reauthenticateWithPopup(user, googleProvider);
    } else {
      if (!email || !password) throw new Error('Email e senha são obrigatórios para confirmar a exclusão.');
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);
    }

    // Step 2 — Delete all Firestore tenant data (returns collected Cloudinary publicIds)
    const rid = restaurant?.restaurantId || restaurant?.id;
    let cloudinaryPublicIds = [];
    if (rid) {
      const result = await deleteAllTenantData(rid, user.uid);
      cloudinaryPublicIds = result?.cloudinaryPublicIds || [];
    }

    // Step 3 — Attempt to delete Cloudinary assets via the API server.
    // In dev: proxied through Vite at /internal-api → localhost:8080.
    // In production: set VITE_API_SERVER_URL to the deployed API server base URL.
    let cloudinaryDeleted = false;
    const cloudinaryOrphans = [...cloudinaryPublicIds];
    if (rid && cloudinaryPublicIds.length > 0) {
      try {
        const apiBase = import.meta.env.VITE_API_SERVER_URL || '';
        const url = apiBase
          ? `${apiBase}/api/cloudinary/tenant/${rid}`
          : `/internal-api/api/cloudinary/tenant/${rid}`;
        const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            cloudinaryDeleted = true;
            cloudinaryOrphans.length = 0;
          } else {
            console.warn('[KitchenCost] Cloudinary deletion partial:', data);
          }
        } else {
          console.warn('[KitchenCost] Cloudinary API server responded with:', res.status);
        }
      } catch (e) {
        // API server not accessible (e.g. production without deployed API server)
        console.warn('[KitchenCost] Cloudinary cleanup skipped — API server not reachable:', e.message);
      }
    } else {
      // No invoice files to clean up
      cloudinaryDeleted = true;
    }

    // Step 4 — Delete Firebase Auth account
    await deleteUser(user);

    // Step 5 — Clear local state
    setUser(null);
    setRestaurant(null);
    setMemberRole(null);

    return { cloudinaryDeleted, cloudinaryFileCount: cloudinaryPublicIds.length, cloudinaryOrphans };
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
