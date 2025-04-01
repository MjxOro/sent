"use client";
import { motion } from "motion/react";
import OAuthButton from "@/components/OAuthButton";
import GoogleIcon from "@/components/GoogleIcon";

const LandingDOM: React.FC = () => {
  const handleGoogleAuth = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center z-10">
      {/* Title positioned at 20% from top */}
      <div className="w-full flex justify-center mt-[20vh]">
        <motion.h1
          className="text-sent-accent text-9xl font-sans font-bold tracking-tight drop-shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          SENT
        </motion.h1>
      </div>

      {/* Button positioned at 20% from bottom with Framer Motion control */}
      <div className="w-full flex justify-center mt-auto mb-[10vh]">
        <OAuthButton
          className="md:w-[40%] w-[75%] max-w-[50rem]"
          onClick={(e) => handleGoogleAuth(e)}
          icon={<GoogleIcon />}
          text="Sign in with Google"
          hoverBgColor="bg-sent-ternary"
          textColor="text-sent-accent"
        />
      </div>
    </div>
  );
};

export default LandingDOM;
