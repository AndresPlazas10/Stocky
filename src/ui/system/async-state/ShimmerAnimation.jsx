export function ShimmerAnimation({ className = '', style = {} }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden rounded-xl bg-slate-200/70 ${className}`}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-[async-shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}

export default ShimmerAnimation;
