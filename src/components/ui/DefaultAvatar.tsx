interface DefaultAvatarProps {
  size?: string;
  className?: string;
}

export default function DefaultAvatar({
  size = "w-10 h-10",
  className = "rounded-lg",
}: DefaultAvatarProps) {
  return (
    <div
      className={`${size} bg-lol-border/60 flex items-center justify-center overflow-hidden shrink-0 ${className}`}
    >
      <svg
        className="w-1/2 h-1/2 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </div>
  );
}
