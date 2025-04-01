"use client";

import { motion } from "motion/react";
import { useState, ReactNode } from "react";

interface OAuthButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon: ReactNode;
  text: string;
  textColor?: string;
  initialBgColor?: string;
  hoverBgColor?: string;
  width?: string;
  className?: string;
}

const OAuthButton: React.FC<OAuthButtonProps> = ({
  onClick,
  icon,
  text,
  textColor = "text-sent-accent",
  initialBgColor = "bg-transparent",
  hoverBgColor = "bg-sent-ternary",
  width = "w-[50%]",
  className = "",
}) => {
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  return (
    <motion.button
      className={`${width} flex justify-center items-center gap-2 ${textColor} text-lg font-medium py-3 px-6 rounded-full shadow-sent border-2 border-sent-accent relative overflow-hidden hover:cursor-pointer ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      onHoverStart={() => setIsButtonHovered(true)}
      onHoverEnd={() => setIsButtonHovered(false)}
      onClick={onClick}
    >
      {/* Base background layer */}
      <div className={`absolute inset-0 ${initialBgColor}`} />

      {/* Half-circle fill effect from bottom to top */}
      <span className="absolute inset-0 block overflow-hidden">
        <motion.span
          className={`block h-full w-full ${hoverBgColor} rounded-t-[15rem]`}
          initial={{ y: "100%" }}
          animate={{
            y: isButtonHovered ? "0%" : "100%",
            borderRadius: isButtonHovered ? "0" : "15rem 15rem 0 0",
          }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </span>

      {/* Content layer */}
      <div className="relative z-20 flex items-center gap-2">
        {icon}
        {text}
      </div>
    </motion.button>
  );
};

export default OAuthButton;
