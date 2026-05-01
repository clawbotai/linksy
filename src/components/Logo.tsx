import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: "h-7 w-7", text: "text-base", sub: "text-[9px]" },
  md: { icon: "h-9 w-9", text: "text-lg", sub: "text-[10px]" },
  lg: { icon: "h-12 w-12", text: "text-xl", sub: "text-xs" },
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const s = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          s.icon,
          "flex items-center justify-center rounded-xl overflow-hidden shadow-lg shadow-primary/20",
        )}
      >
        <img
          src="/logo.png"
          alt="Linksy"
          className="h-full w-full object-cover"
        />
      </div>
      {showText && (
        <div>
          <h1
            className={cn(
              s.text,
              "bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text font-semibold text-transparent",
            )}
          >
            Linksy
          </h1>
          <p className={cn(s.sub, "text-muted-foreground -mt-0.5")}>
            Turn any link into knowledge
          </p>
        </div>
      )}
    </div>
  );
}
