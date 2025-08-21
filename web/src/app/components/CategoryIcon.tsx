// CategoryIcon.tsx
import React from 'react';

interface CategoryIconProps {
  category?: string;
  size?: number;
  className?: string;
}

/**
 * Icon component for different POI categories
 */
const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  category = 'unknown', 
  size = 24,
  className = ''
}) => {
  // Map categories to emoji icons
  const getIconForCategory = (cat: string): string => {
    const categoryMap: Record<string, string> = {
      'catering': '🍽️',
      'restaurant': '🍽️',
      'cafe': '☕',
      'bar': '🍸',
      'pub': '🍺',
      'fast_food': '🍔',
      'hotel': '🏨',
      'hostel': '🛏️',
      'guest_house': '🏠',
      'museum': '🏛️',
      'gallery': '🖼️',
      'attraction': '🎭',
      'monument': '🗿',
      'tourism': '🏛️',
      'viewpoint': '🏞️',
      'park': '🌳',
      'garden': '🌷',
      'beach': '🏖️',
      'recreation': '🎡',
      'sports': '⚽',
      'stadium': '🏟️',
      'entertainment': '🎪',
      'cinema': '🎬',
      'theatre': '🎭',
      'shop': '🛍️',
      'mall': '🏬',
      'supermarket': '🛒',
      'convenience': '🏪',
      'pharmacy': '💊',
      'healthcare': '🏥',
      'hospital': '🏥',
      'doctor': '👨‍⚕️',
      'dentist': '🦷',
      'clinic': '🩺',
      'transportation': '🚏',
      'bus_stop': '🚏',
      'train_station': '🚉',
      'subway': '🚇',
      'tram_stop': '🚊',
      'ferry_terminal': '⛴️',
      'airport': '✈️',
      'parking': '🅿️',
      'fuel': '⛽',
      'charging_station': '🔌',
      'bank': '🏦',
      'atm': '💳',
      'post_office': '📮',
      'place_of_worship': '⛪',
      'church': '⛪',
      'mosque': '🕌',
      'synagogue': '🕍',
      'temple': '🛕',
      'education': '🏫',
      'school': '🏫',
      'university': '🎓',
      'library': '📚',
      'toilets': '🚻',
      'water': '💧',
      'information': 'ℹ️',
      'historic': '🏰',
      'castle': '🏰',
      'ruins': '🏛️',
      'landmark': '🗿',
      'natural': '🌲',
      'forest': '🌲',
      'water_feature': '💦',
      'waterfall': '🌊',
      'cave': '🕳️',
      'craft': '🧶',
      'office': '🏢',
      'residential': '🏘️',
      'industrial': '🏭',
      'commercial': '🏬',
      'unknown': '📍'
    };
    
    // Normalize category and find in map
    const normalizedCategory = cat.toLowerCase().replace(/[^a-z_]/g, '');
    
    // Try exact match
    if (categoryMap[normalizedCategory]) {
      return categoryMap[normalizedCategory];
    }
    
    // Try partial match
    const partialMatch = Object.keys(categoryMap).find(key => 
      normalizedCategory.includes(key) || key.includes(normalizedCategory)
    );
    
    return partialMatch ? categoryMap[partialMatch] : categoryMap['unknown'];
  };
  
  const iconStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${size * 0.7}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
  
  return (
    <div className={`category-icon ${className}`} style={iconStyle}>
      {getIconForCategory(category)}
    </div>
  );
};

export default CategoryIcon;
