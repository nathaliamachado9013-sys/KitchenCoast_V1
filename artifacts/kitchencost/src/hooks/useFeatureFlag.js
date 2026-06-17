import { useState, useEffect } from 'react';
import { isFeatureFlagEnabled } from '../lib/featureFlags';

/**
 * Hook para usar feature flags em componentes React
 *
 * @param {string} flagName - Nome da feature flag (ex: 'new-profit-calc')
 * @param {string} restaurantId - ID do restaurante
 * @param {string} userId - ID do usuário
 * @returns {boolean} - Se a feature está ativada para este usuário
 *
 * Exemplo de uso:
 * const MyComponent = () => {
 *   const useNewProfitCalc = useFeatureFlag('new-profit-calc', restaurantId, userId);
 *
 *   return useNewProfitCalc ? <NewVersion /> : <OldVersion />;
 * };
 */
export const useFeatureFlag = (flagName, restaurantId, userId) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!flagName || !restaurantId || !userId) {
      setLoading(false);
      return;
    }

    const checkFlag = async () => {
      try {
        const enabled = await isFeatureFlagEnabled(restaurantId, flagName, userId);
        setIsEnabled(enabled);
        setError(null);
      } catch (err) {
        console.error(`Error checking feature flag "${flagName}":`, err);
        setError(err);
        setIsEnabled(false); // Fail-safe: desativa feature se houver erro
      } finally {
        setLoading(false);
      }
    };

    checkFlag();
  }, [flagName, restaurantId, userId]);

  return { isEnabled, loading, error };
};
