import { cn } from "../../utils/cn";

export function SkeletonLine({ className }) {
  return <div className={cn("skeleton h-3 rounded-full", className)} />;
}

export function SkeletonCircle({ size = 44, className }) {
  return (
    <div
      className={cn("skeleton rounded-full shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonPostCard() {
  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonCircle size={44} />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-32" />
          <SkeletonLine className="w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-4/5" />
      </div>
      <div className="skeleton h-64 w-full rounded-xl2" />
      <div className="flex gap-6 pt-1">
        <SkeletonLine className="w-14" />
        <SkeletonLine className="w-14" />
        <SkeletonLine className="w-14" />
      </div>
    </div>
  );
}

export function SkeletonUserRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <SkeletonCircle size={40} />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="w-28" />
        <SkeletonLine className="w-16" />
      </div>
    </div>
  );
}

export function SkeletonFeed({ count = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPostCard key={i} />
      ))}
    </div>
  );
}
