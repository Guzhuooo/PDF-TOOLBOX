import { memo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { GitCompare, Layers, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 顶部 Tab 导航配置
 */
const NAV_TABS = [
  {
    path: '/diff',
    label: '文本对比',
    icon: GitCompare,
    shortLabel: '对比',
  },
  {
    path: '/dedup',
    label: '文本去重',
    icon: Layers,
    shortLabel: '去重',
  },
  {
    path: '/stats',
    label: '文本统计',
    icon: BarChart3,
    shortLabel: '统计',
  },
];

/**
 * 顶部 Tab 导航组件
 * 玻璃拟态风格，3 个功能 Tab 切换，NavLink 高亮
 */
function TabNav() {
  const { pathname } = useLocation();

  return (
    <nav className="w-full">
      <div
        className={cn(
          'mx-auto flex max-w-2xl items-center gap-1 rounded-2xl p-1.5',
          'border border-white/30 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5',
          'dark:border-white/10 dark:bg-background/30 dark:shadow-black/20'
        )}
      >
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.path);
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive: navActive }) =>
                cn(
                  'relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background/50',
                  navActive || isActive
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default memo(TabNav);
