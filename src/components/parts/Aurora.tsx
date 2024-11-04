export const Aurora: React.FC = () => {
  return (
    <>
      <style>
        {`
      @keyframes aurora {
        0% {
          background-position: 50% 50%, 50% 50%;
        }
        100% {
          background-position: 350% 50%, 350% 50%;
        }
      }
      `}
      </style>
      <div
        className="absolute top-0 left-0 w-full h-[500px] opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(100deg,#fff,#fff 7%,transparent 10%,transparent 12%,#fff 16%),repeating-linear-gradient(100deg,#60a5fa 10%,#e879f9 16%,#5eead4 22%,#60a5fa 30%)",
          WebkitMaskImage: "radial-gradient(ellipse at 100% 0,#fff 10%,transparent 70%)",
          zIndex: -1,
          backgroundPosition: "50% 50%,50% 50%",
          backgroundSize: "300%,200%",
          animation: "aurora 180s ease-in-out -70s infinite alternate",
        }}
      />
    </>
  );
};
