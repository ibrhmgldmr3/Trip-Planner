// AnimatedRoute.tsx
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

interface AnimatedRouteProps {
  positions: L.LatLngExpression[];
  color?: string;
  weight?: number;
  opacity?: number;
  dashArray?: string;
  pulseColor?: string;
  startMarker?: boolean;
  endMarker?: boolean;
  animated?: boolean;
  duration?: number;
}

/**
 * Enhanced route line component with animation and markers
 */
const AnimatedRoute: React.FC<AnimatedRouteProps> = ({
  positions,
  color = '#ef4444',
  weight = 5,
  opacity = 0.7,
  dashArray = '',
  pulseColor = '#ef4444',
  startMarker = true,
  endMarker = true,
  animated = true,
  duration = 2000,
}) => {
  const map = useMap();
  const routeRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const pulseRef = useRef<L.DivIcon | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing layers
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
    }
    
    markersRef.current.forEach(marker => {
      if (marker) map.removeLayer(marker);
    });
    markersRef.current = [];

    if (positions.length < 2) return;

    // Create the main route line
    routeRef.current = L.polyline(positions, {
      color,
      weight,
      opacity,
      lineJoin: 'round',
      dashArray,
    }).addTo(map);

    // Add start marker if enabled
    if (startMarker && positions.length > 0) {
      const startIcon = L.divIcon({
        className: 'custom-route-marker start-marker',
        iconSize: [24, 24],
        html: `<div style="background-color: #10b981; width: 14px; height: 14px; border-radius: 50%; 
               border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5); 
               display: flex; align-items: center; justify-content: center; 
               color: white; font-weight: bold; font-size: 10px;">S</div>`
      });
      
      const marker = L.marker(positions[0], { icon: startIcon }).addTo(map);
      markersRef.current.push(marker);
    }

    // Add end marker if enabled
    if (endMarker && positions.length > 1) {
      const endIcon = L.divIcon({
        className: 'custom-route-marker end-marker',
        iconSize: [24, 24],
        html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; 
               border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5); 
               display: flex; align-items: center; justify-content: center; 
               color: white; font-weight: bold; font-size: 10px;">F</div>`
      });
      
      const marker = L.marker(positions[positions.length - 1], { icon: endIcon }).addTo(map);
      markersRef.current.push(marker);
    }

    // Create pulse animation marker if animation is enabled
    if (animated && positions.length > 1) {
      // Create the pulse icon
      pulseRef.current = L.divIcon({
        className: 'route-pulse-icon',
        iconSize: [20, 20],
        html: `<div class="pulse-animation" style="background-color: ${pulseColor};"></div>`
      });

      // Add CSS for the pulse animation if it doesn't exist
      if (!document.getElementById('pulse-animation-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-animation-style';
        style.innerHTML = `
          .pulse-animation {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 0 rgba(239, 68, 68, 0.4);
            animation: pulse 1.5s infinite;
          }
          
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Animate the route
      let start = 0;
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const percentage = Math.min(progress / duration, 1);
        
        if (percentage < 1 && routeRef.current) {
          // Find the point along the polyline
          const point = routeRef.current.getLatLngs();
          const pointIndex = Math.floor(percentage * (point.length - 1));
          const pointPercentage = (percentage * (point.length - 1)) % 1;
          
          if (pointIndex < point.length - 1) {
            const p1 = point[pointIndex] as L.LatLng;
            const p2 = point[pointIndex + 1] as L.LatLng;
            
            const lat = p1.lat + (p2.lat - p1.lat) * pointPercentage;
            const lng = p1.lng + (p2.lng - p1.lng) * pointPercentage;
            
            // Update the position of the pulse marker
            if (pulseRef.current) {
              const marker = L.marker([lat, lng], { icon: pulseRef.current }).addTo(map);
              markersRef.current.push(marker);
              
              // Remove the previous pulse marker to avoid too many markers
              if (markersRef.current.length > 3) {
                const oldMarker = markersRef.current.shift();
                if (oldMarker) map.removeLayer(oldMarker);
              }
            }
            
            animationRef.current = requestAnimationFrame(animate);
          }
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }

    // Fit the map to the route bounds with padding
    if (positions.length > 1) {
      map.fitBounds(routeRef.current.getBounds(), {
        padding: [50, 50],
        maxZoom: 16
      });
    }

    // Cleanup function
    return () => {
      if (routeRef.current) {
        map.removeLayer(routeRef.current);
      }
      
      markersRef.current.forEach(marker => {
        if (marker) map.removeLayer(marker);
      });
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [positions, color, weight, opacity, dashArray, pulseColor, startMarker, endMarker, animated, duration, map]);

  return null;
};

export default AnimatedRoute;
