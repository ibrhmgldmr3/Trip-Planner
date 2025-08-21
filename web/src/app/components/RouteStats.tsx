// RouteStats.tsx
import React, { useEffect, useState } from 'react';

interface RouteStatsProps {
  distance?: number;
  duration?: number;
  routeComplete?: boolean;
}

/**
 * Route statistics component
 * Shows formatted distance and duration with animated counters
 */
const RouteStats: React.FC<RouteStatsProps> = ({
  distance = 0,
  duration = 0,
  routeComplete = false,
}) => {
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  
  // Animation effect
  useEffect(() => {
    if (distance === 0 || duration === 0) {
      setCurrentDistance(0);
      setCurrentDuration(0);
      return;
    }
    
    // Animate distance
    const distanceSteps = 20;
    const distanceStep = distance / distanceSteps;
    let distanceCount = 0;
    
    const distanceInterval = setInterval(() => {
      distanceCount++;
      setCurrentDistance(prev => {
        const next = prev + distanceStep;
        return next > distance ? distance : next;
      });
      
      if (distanceCount >= distanceSteps) {
        clearInterval(distanceInterval);
        setCurrentDistance(distance);
      }
    }, 50);
    
    // Animate duration
    const durationSteps = 20;
    const durationStep = duration / durationSteps;
    let durationCount = 0;
    
    const durationInterval = setInterval(() => {
      durationCount++;
      setCurrentDuration(prev => {
        const next = prev + durationStep;
        return next > duration ? duration : next;
      });
      
      if (durationCount >= durationSteps) {
        clearInterval(durationInterval);
        setCurrentDuration(duration);
      }
    }, 50);
    
    return () => {
      clearInterval(distanceInterval);
      clearInterval(durationInterval);
    };
  }, [distance, duration]);
  
  // Format duration helper
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}s ${minutes}dk`;
    }
    return `${minutes}dk`;
  };

  // Format distance helper
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };
  
  if (distance === 0 || duration === 0) {
    return null;
  }
  
  return (
    <div className="route-stats-card hover-lift">
      <div className="route-stats-title">
        Rota İstatistikleri
        {routeComplete && (
          <span className="route-complete-badge pop-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Tamamlandı
          </span>
        )}
      </div>
      
      <div className="route-stats-grid">
        <div className="route-stat-item hover-scale">
          <div className="route-stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="route-stat-value">{formatDistance(currentDistance)}</div>
          <div className="route-stat-label">Toplam Mesafe</div>
        </div>
        
        <div className="route-stat-item hover-scale">
          <div className="route-stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="route-stat-value">{formatDuration(currentDuration)}</div>
          <div className="route-stat-label">Tahmini Süre</div>
        </div>
      </div>
      
      {routeComplete && (
        <div className="mt-4 text-xs text-gray-500 bg-blue-50 p-2 rounded-md fade-in">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mr-1 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>
              Bu rota, seçilen noktaları en verimli şekilde ziyaret etmenizi sağlayacak şekilde optimize edilmiştir.
              Yürüme hızınıza bağlı olarak tahmini süre değişebilir.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteStats;
