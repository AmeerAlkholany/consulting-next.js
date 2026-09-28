import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Horizontal page gutter and width cap. Sizes come from the `--container-*`
 * tokens in app/globals.css (ARCHITECTURE.md §30).
 */
const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      /** Application content — capped at ~1200px */
      content: "max-w-content",
      /** Forms — capped at ~640px */
      form: "max-w-form",
      /** Long-form reading — capped at ~72ch */
      measure: "max-w-measure",
      /** Padding only, full width */
      full: "",
    },
  },
  defaultVariants: {
    size: "content",
  },
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof containerVariants> {}

const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size, ...props }, ref) => (
    <div ref={ref} className={cn(containerVariants({ size }), className)} {...props} />
  ),
);
Container.displayName = "Container";

export { Container, containerVariants };
