import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatAverageRating } from "@/schemas/review";

interface RatingDisplayProps {
  ratingSum: number;
  ratingCount: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

export function RatingDisplay({
  ratingSum,
  ratingCount,
  size = "md",
  showCount = true,
  className,
}: RatingDisplayProps) {
  const avg = ratingCount > 0 ? ratingSum / ratingCount : 0;
  const formatted = formatAverageRating(ratingSum, ratingCount);

  const starSizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const textClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-semibold",
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <div className="flex items-center text-yellow-500" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const filled = avg >= starIndex;
          const half = !filled && avg >= starIndex - 0.5;

          if (filled) {
            return <Star key={starIndex} className={cn(starSizeClasses[size], "fill-current")} />;
          }
          if (half) {
            return (
              <StarHalf key={starIndex} className={cn(starSizeClasses[size], "fill-current")} />
            );
          }
          return (
            <Star
              key={starIndex}
              className={cn(starSizeClasses[size], "text-muted-foreground/30")}
            />
          );
        })}
      </div>

      <span className={cn("font-medium", textClasses[size])}>{formatted}</span>

      {showCount && (
        <span className={cn("text-muted-foreground", textClasses[size])}>
          ({ratingCount} {ratingCount === 1 ? "review" : "reviews"})
        </span>
      )}
    </div>
  );
}
