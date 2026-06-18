import { collection, query, where, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase-config';

// Hash function para determinar se usuário está no rollout
const hashUserId = (userId) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Get feature flag status for a user
export const isFeatureFlagEnabled = async (restaurantId, flagName, userId) => {
  try {
    const flagRef = doc(db, 'restaurants', restaurantId, 'feature_flags', flagName);
    const flagSnap = await getDoc(flagRef);

    if (!flagSnap.exists()) {
      // Flag não existe = desativado por padrão
      return false;
    }

    const flag = flagSnap.data();

    // Verificar se flag está globalmente ativado
    if (!flag.enabled) {
      return false;
    }

    // Verificar se está no período válido
    if (flag.startDate && new Date() < new Date(flag.startDate.toDate())) {
      return false;
    }
    if (flag.endDate && new Date() > new Date(flag.endDate.toDate())) {
      return false;
    }

    // Verificar rollout percentual
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const userHash = hashUserId(userId);
      const isInRollout = (userHash % 100) < flag.rolloutPercentage;
      if (!isInRollout) {
        return false;
      }
    }

    // Verificar se usuário está em whitelist
    if (flag.whitelistedUsers && Array.isArray(flag.whitelistedUsers)) {
      if (!flag.whitelistedUsers.includes(userId)) {
        return false;
      }
    }

    // Verificar se usuário está em blacklist
    if (flag.blacklistedUsers && Array.isArray(flag.blacklistedUsers)) {
      if (flag.blacklistedUsers.includes(userId)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return false;
  }
};

// Create or update a feature flag (admin only)
export const createFeatureFlag = async (restaurantId, flagName, config) => {
  try {
    const flagRef = doc(db, 'restaurants', restaurantId, 'feature_flags', flagName);
    await setDoc(flagRef, {
      name: flagName,
      enabled: config.enabled ?? false,
      rolloutPercentage: config.rolloutPercentage ?? 0,
      whitelistedUsers: config.whitelistedUsers ?? [],
      blacklistedUsers: config.blacklistedUsers ?? [],
      startDate: config.startDate ?? null,
      endDate: config.endDate ?? null,
      description: config.description ?? '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return true;
  } catch (error) {
    console.error('Error creating feature flag:', error);
    throw error;
  }
};

// List all feature flags for a restaurant
export const listFeatureFlags = async (restaurantId) => {
  try {
    const flagsRef = collection(db, 'restaurants', restaurantId, 'feature_flags');
    const flagsSnap = await getDocs(flagsRef);
    return flagsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error listing feature flags:', error);
    return [];
  }
};

// Update feature flag rollout percentage
export const updateFlagRollout = async (restaurantId, flagName, rolloutPercentage) => {
  try {
    const flagRef = doc(db, 'restaurants', restaurantId, 'feature_flags', flagName);
    await setDoc(flagRef, { rolloutPercentage, updatedAt: new Date() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating flag rollout:', error);
    throw error;
  }
};

// Enable/disable a feature flag
export const setFlagEnabled = async (restaurantId, flagName, enabled) => {
  try {
    const flagRef = doc(db, 'restaurants', restaurantId, 'feature_flags', flagName);
    await setDoc(flagRef, { enabled, updatedAt: new Date() }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error enabling/disabling flag:', error);
    throw error;
  }
};
