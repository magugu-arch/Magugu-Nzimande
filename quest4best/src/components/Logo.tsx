type LogoProps = {
  className?: string;
};

// Reversed (light) lockup, for dark backgrounds only. Never recolour, crop or
// add effects — swap the file for the vector master when it is supplied.
export function Logo({ className = '' }: LogoProps) {
  return (
    <img
      src="/assets/quest4best-logo.png"
      alt="Quest4Best Consulting"
      width={1024}
      height={200}
      className={`h-auto select-none ${className}`}
      draggable={false}
    />
  );
}
