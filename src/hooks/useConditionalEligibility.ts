import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const useConditionalEligibility = () => {
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkEligibility = () => {
      // Special case for BNPL route - don't check eligibility
      if (location.pathname === '/bnpl') {
        setIsEligible(true); // Allow access to BNPL checker
        setIsLoading(false);
        return;
      }

      const eligibilityData = localStorage.getItem('eligibilityData');
      
      if (!eligibilityData) {
        setIsEligible(null);
        setIsLoading(false);
        return;
      }

      const { eligible, timestamp } = JSON.parse(eligibilityData);
      
      // Eligibility expires after 30 days
      const isExpired = Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000;
      
      if (isExpired) {
        localStorage.removeItem('eligibilityData');
        setIsEligible(null);
      } else {
        setIsEligible(eligible);
      }
      
      setIsLoading(false);
    };

    checkEligibility();
  }, [location.pathname]);

  const redirectToEligibilityCheck = () => {
    // For BNPL, allow direct access without authentication
    if (location.pathname === '/bnpl' || location.pathname.includes('/bnpl')) {
      navigate('/bnpl');
      return;
    }

    // For other eligibility checks, require authentication
    if (!isAuthenticated) {
      navigate('/register');
    } else {
      navigate('/eligibility');
    }
  };

  return {
    isEligible,
    isLoading,
    redirectToEligibilityCheck
  };
};