"use client";
import { useAuth } from "@/providers/auth-provider";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const handleGoogleAuth = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    window.location.href = `${process.env.NEXT_PUBLIC_SERVERURI}/api/auth/login`;
  };
  return (
    <div className="absolute inset-0 flex flex-col items-center z-10">
      <div>DASHBOARD PAGE!</div>
      <div>{`WELCOME ${user?.name}`}</div>
    </div>
  );
};

export default Dashboard;
