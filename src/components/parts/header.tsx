import { ModeToggle } from "./mode-toggle";

export const Header: React.FC = () => {
  return (
    <div className="absolute top-0 right-0 mr-8 mt-4 flex justify-end">
      <ModeToggle />
    </div>
  );
};
