import { memo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  FileText,
  Image,
  QrCode,
  Type,
  Calculator,
  ChevronDown,
  ShieldCheck,
  Layers,
  Scissors,
  RotateCw,
  Lock,
  Unlock,
  Minimize2,
  Repeat,
  Maximize2,
  Sticker,
  ScanLine,
  Sparkles,
  ListPlus,
  GitCompare,
  RemoveFormatting,
  BarChart3,
  Ruler,
  Home,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/**
 * 导航分组配置
 * 5大工具模块：PDF工具箱 / 图片工具箱 / 二维码工具箱 / 文本工具箱 / 计算工具箱
 */
const NAV_GROUPS = [
  {
    key: 'pdf',
    label: 'PDF工具箱',
    icon: FileText,
    items: [
      { path: '/pdf/merge', label: 'PDF合并', icon: Layers },
      { path: '/pdf/split', label: 'PDF拆分', icon: Scissors },
      { path: '/pdf/rotate', label: 'PDF旋转', icon: RotateCw },
      { path: '/pdf/encrypt', label: 'PDF加密', icon: Lock },
      { path: '/pdf/decrypt', label: 'PDF解密', icon: Unlock },
    ],
  },
  {
    key: 'image',
    label: '图片工具箱',
    icon: Image,
    items: [
      { path: '/image/compress', label: '图片压缩', icon: Minimize2 },
      { path: '/image/convert', label: '格式转换', icon: Repeat },
      { path: '/image/resize', label: '尺寸调整', icon: Maximize2 },
      { path: '/image/watermark', label: '文字水印', icon: Sticker },
    ],
  },
  {
    key: 'qrcode',
    label: '二维码工具箱',
    icon: QrCode,
    items: [
      { path: '/qrcode/generate', label: '二维码生成', icon: QrCode },
      { path: '/qrcode/scan', label: '二维码识别', icon: ScanLine },
      { path: '/qrcode/beautify', label: '二维码美化', icon: Sparkles },
      { path: '/qrcode/batch', label: '批量生成', icon: ListPlus },
    ],
  },
  {
    key: 'text',
    label: '文本工具箱',
    icon: Type,
    items: [
      { path: '/text/diff', label: '文本对比', icon: GitCompare },
      { path: '/text/dedup', label: '文本去重', icon: RemoveFormatting },
      { path: '/text/stats', label: '文本统计', icon: BarChart3 },
    ],
  },
  {
    key: 'calc',
    label: '计算工具箱',
    icon: Calculator,
    items: [
      { path: '/calc/converter', label: '单位换算', icon: Ruler },
      { path: '/calc/calculator', label: '科学计算器', icon: Calculator },
      { path: '/calc/mortgage', label: '房贷计算器', icon: Home },
    ],
  },
];

/**
 * 应用侧边栏组件
 * 玻璃拟态风格，5大工具模块分组导航
 */
function AppSidebar() {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // 展开的分组（默认全部展开）
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    pdf: true,
    image: true,
    qrcode: true,
    text: true,
    calc: true,
  });

  /** 切换分组展开/收起 */
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** 判断某个分组是否有激活的子项 */
  const hasActiveChild = (items: { path: string }[]) => {
    return items.some((item) => pathname === item.path || pathname.startsWith(item.path + '/'));
  };

  return (
    <Sidebar
      collapsible="icon"
      className="!bg-background/60 !backdrop-blur-xl !border-r border-border/30"
    >
      {/* Logo 区域 */}
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center gap-3 px-2 py-4 group-data-[state=collapsed]:px-0 group-data-[state=collapsed]:justify-center">
          <div className="size-10 shrink-0 rounded-xl bg-gradient-to-br from-primary to-purple-600 text-primary-foreground flex items-center justify-center text-sm font-bold shadow-lg shadow-primary/20">
            5合1
          </div>
          <div className="flex-1 min-w-0 group-data-[state=collapsed]:hidden">
            <div className="text-sm font-bold text-foreground truncate">
              全能办公工具箱
            </div>
            <div className="text-xs text-muted-foreground truncate">
              PDF · 图片 · 二维码 · 文本 · 计算
            </div>
          </div>
        </div>
      </SidebarHeader>

      {/* 导航菜单 */}
      <SidebarContent>
        <div className="p-2 space-y-1">
          {NAV_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups[group.key];
            const isActive = hasActiveChild(group.items);

            return (
              <div key={group.key} className="space-y-0.5">
                {/* 分组标题 */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200',
                    'hover:bg-accent/50 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title={isCollapsed ? group.label : undefined}
                >
                  <GroupIcon className="size-4 shrink-0" />
                  <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wider group-data-[state=collapsed]:hidden">
                    {group.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'size-3.5 shrink-0 transition-transform duration-200 group-data-[state=collapsed]:hidden',
                      isExpanded ? '' : '-rotate-90'
                    )}
                  />
                </button>

                {/* 子菜单 */}
                {isExpanded && !isCollapsed && (
                  <SidebarMenu className="space-y-0.5 pl-2">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemActive = pathname === item.path || pathname.startsWith(item.path + '/');
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            asChild
                            tooltip={item.label}
                            isActive={itemActive}
                            className={cn(
                              'h-9 rounded-lg transition-all duration-200',
                              itemActive
                                ? 'bg-gradient-to-r from-primary/20 to-primary/5 text-primary font-medium shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            )}
                          >
                            <NavLink
                              to={item.path}
                              className="flex items-center gap-2.5"
                            >
                              <ItemIcon
                                className={cn(
                                  'size-[16px] shrink-0 transition-all duration-200',
                                  itemActive ? 'text-primary' : ''
                                )}
                              />
                              <span className="text-sm">{item.label}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部隐私提示 */}
        <SidebarGroup className="mt-auto p-2">
          <div className="rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm p-3 group-data-[state=collapsed]:hidden">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-primary/70" />
              <span>纯前端本地处理</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/70 leading-relaxed">
              所有操作仅在您的浏览器中完成，不上传任何服务器，保护数据安全
            </p>
          </div>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default memo(AppSidebar);
