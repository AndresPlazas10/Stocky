const GradientButton = ({
  children,
  minWidth,
  height = '60px',
  className = '',
  onClick,
  disabled = false,
  variant = 'default',
  ...props
}) => {
  const heightValue = variant === 'small' ? '40px' : height;
  
  const commonGradientStyles = `
    relative rounded-[50px] cursor-pointer
    after:content-[""] after:block after:absolute after:bg-[#111]
    after:inset-[4px] after:rounded-[46px] after:z-[1]
    after:transition-opacity after:duration-300 after:ease-linear
    flex items-center justify-center
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div className="text-center inline-block">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`
          ${commonGradientStyles}
          rotatingGradient
          ${className}
        `}
        style={{
          '--r': '0deg',
          minWidth: minWidth,
          height: heightValue,
          padding: variant === 'small' ? '0 20px' : '0 30px'
        }}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled}
        {...props}
      >
        <span className="relative z-10 text-white flex items-center justify-center font-semibold text-sm">
          {children}
        </span>
      </div>
    </div>
  );
};

export default GradientButton;
