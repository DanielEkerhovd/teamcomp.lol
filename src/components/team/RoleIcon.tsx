import { Role } from '../../types';

interface RoleIconProps {
  role: Role;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

// Map our role names to Community Dragon position names
const ROLE_TO_POSITION: Record<Role, string> = {
  top: 'top',
  jungle: 'jungle',
  mid: 'middle',
  adc: 'bottom',
  support: 'utility',
  flex: 'fill',
};

const SIZE_CLASSES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

export default function RoleIcon({ role, size = 'sm', className = '' }: RoleIconProps) {
  const position = ROLE_TO_POSITION[role];
  const iconUrl = `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${position}.png`;

  return (
    <img
      src={iconUrl}
      alt={role}
      className={`${SIZE_CLASSES[size]} ${className}`}
      title={role}
    />
  );
}
