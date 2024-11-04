import { Aurora } from "../parts/Aurora";
import { AppSidebar } from "../parts/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "../ui/sidebar";

type MainLayoutProps = {
  children: React.ReactNode;
};

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <>
      <Aurora />
      <SidebarProvider>
        <AppSidebar />
        <main>
          <SidebarTrigger />
          <div className="py-2 px-12">{children}</div>
        </main>
      </SidebarProvider>
    </>
  );
};
