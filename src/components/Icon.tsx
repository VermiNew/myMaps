import React from 'react';
import {
  FiArrowRight, FiMapPin, FiNavigation2, FiX, FiMenu, FiMic, FiMap,
  FiSearch, FiSquare, FiStar, FiPlay, FiPause, FiSettings, FiMoon,
  FiPlus, FiArrowLeft, FiVolume2, FiLayers, FiTrash2, FiArrowUp, FiArrowDown
} from 'react-icons/fi';

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  arrow: FiArrowRight,
  arrive: FiMapPin,
  compass: FiNavigation2,
  close: FiX,
  location: FiMapPin,
  left: FiArrowLeft,
  menu: FiMenu,
  mic: FiMic,
  moon: FiMoon,
  pause: FiPause,
  play: FiPlay,
  plus: FiPlus,
  right: FiArrowRight,
  route: FiMap,
  search: FiSearch,
  star: FiStar,
  stop: FiSquare,
  volume: FiVolume2,
  layers: FiLayers,
  gear: FiSettings,
  trash: FiTrash2,
  straight: FiArrowUp,
  arrival: FiArrowDown,
};

interface IconProps {
  name: string;
  size?: number;
}

export default function Icon({ name, size = 20 }: IconProps) {
  const Component = iconMap[name];
  if (!Component) {
    return <FiMapPin size={size} />;
  }
  return <Component size={size} />;
}
