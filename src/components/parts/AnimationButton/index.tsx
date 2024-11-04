"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAnimation } from "framer-motion";
import { type AnimationIcon, AnimationIcons } from "./consts";

type AnimationButtonProps = {
  icon: AnimationIcon;
  iconClassName?: string;
  children: React.ReactNode;
} & ButtonProps;

export const AnimationButton: React.FC<AnimationButtonProps> = ({ icon, iconClassName, children, ...buttonProps }) => {
  const Icon = AnimationIcons[icon];
  const controls = useAnimation();

  return (
    <Button
      onMouseEnter={() => controls.start("animate")}
      onMouseLeave={() => controls.start("normal")}
      className="flex items-center justify-center"
      {...buttonProps}
    >
      {Icon && (
        <div className={cn("flex items-center justify-center mr-2 w-6 h-6", iconClassName)}>
          <Icon controls={controls} />
        </div>
      )}
      {children}
    </Button>
  );
};
