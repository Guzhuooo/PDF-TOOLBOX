import { Outlet } from 'react-router-dom';
import Header from '@/components/Header';
import AppSidebar from '@/components/AppSidebar';
import { LicenseProvider, useLicense } from '@/contexts/LicenseContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ActivationDialog from '@/components/ActivationDialog';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

function LayoutContent() {
  const { showActivationDialog, setShowActivationDialog } = useLicense();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* 装饰性光晕背景 - 玻璃拟态氛围 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-secondary/30 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <div className="relative z-10 flex min-h-screen w-full">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex flex-col min-w-0 overflow-x-hidden">
            <Header />
            <main className="flex-1 w-full overflow-y-auto px-4 md:px-6 lg:px-8 py-6">
              <div className="mx-auto w-full max-w-6xl">
                <Outlet />
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>

      {/* 全局激活弹窗 */}
      <ActivationDialog
        open={showActivationDialog}
        onOpenChange={setShowActivationDialog}
      />
    </div>
  );
}

export function Layout() {
  return (
    <ThemeProvider>
      <LicenseProvider>
        <LayoutContent />
      </LicenseProvider>
    </ThemeProvider>
  );
}
