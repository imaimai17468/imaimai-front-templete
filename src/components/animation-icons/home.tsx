"use client";

import { type Transition, type Variants, motion, type useAnimation } from "framer-motion";

const defaultTransition: Transition = {
  duration: 0.6,
  opacity: { duration: 0.2 },
};

const pathVariants: Variants = {
  normal: {
    pathLength: 1,
    opacity: 1,
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
  },
};

type HomeIconProps = {
  controls: ReturnType<typeof useAnimation>;
};

const HomeIcon: React.FC<HomeIconProps> = ({ controls }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Home</title>
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <motion.path
        d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
        variants={pathVariants}
        transition={defaultTransition}
        animate={controls}
      />
    </svg>
  );
};

export { HomeIcon };
