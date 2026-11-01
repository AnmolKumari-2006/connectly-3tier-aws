import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import RightSidebar from "./RightSidebar";
import MobileHeader from "./MobileHeader";
import MobileNav from "./MobileNav";
import CreatePostModal from "../post/CreatePostModal";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex justify-center">
      <Sidebar />

      <div className="flex-1 min-w-0 max-w-3xl flex flex-col">
        <MobileHeader />
        <main className="flex-1 px-3 sm:px-5 py-4 sm:py-6 pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <RightSidebar />
      <MobileNav />
      <CreatePostModal />
    </div>
  );
}
