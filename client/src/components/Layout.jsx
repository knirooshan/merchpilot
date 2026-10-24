import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../store/slices/authSlice";
import { fetchSettings } from "../store/slices/settingsSlice";
import { ENDPOINTS } from "../config/api";
import {
  LayoutDashboard,
  Settings,
  Package,
  Users,
  ShoppingCart,
  FileText,
  LogOut,
  Menu,
  X,
  Monitor,
  DollarSign,
  BarChart3,
  Image,
  Truck,
  AlertCircle,
} from "lucide-react";
import { Toaster } from "react-hot-toast";

const Layout = () => {
  const { user } = useSelector((state) => state.auth);
  const { loaded: settingsLoaded, data: settings } = useSelector(
    (state) => state.settings,
  );
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user && !settingsLoaded) {
      dispatch(fetchSettings());
    }
  }, [user, settingsLoaded, dispatch]);

  const allNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "POS", href: "/pos", icon: Monitor, requiresModule: "pos" },
    { name: "Products", href: "/products", icon: Package },
    { name: "Quotations", href: "/quotations", icon: FileText },
    { name: "Invoices", href: "/invoices", icon: FileText },
    { name: "Deliveries", href: "/deliveries", icon: Truck },
    {
      name: "Orders",
      href: "/orders",
      icon: ShoppingCart,
    },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Vendors", href: "/vendors", icon: Users },
    { name: "Payments", href: "/payments", icon: FileText },
    { name: "Expenses", href: "/expenses", icon: DollarSign },
    { name: "Media Library", href: "/media-library", icon: Image },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    {
      name: "Outstanding Invoices",
      href: "/outstanding-invoices",
      icon: AlertCircle,
    },
    ...(user?.role === "admin"
      ? [
        { name: "Users", href: "/users", icon: Users },
        { name: "Settings", href: "/settings", icon: Settings },
      ]
      : []),
    ...(user?.isSuperAdmin
      ? [
        { name: "Tenants", href: "/tenants", icon: Users },
        { name: "System Settings", href: "/admin/settings", icon: Settings },
      ]
      : []),
  ];

  // Filter navigation based on module settings and user role
  const navigation = allNavigation.filter((item) => {
    // Super Admin only sees Tenants and System Settings
    if (user?.isSuperAdmin) {
      return item.name === "Tenants" || item.name === "System Settings";
    }

    // Hide Tenants from non-Super Admins (already handled by logic above, but safety check)
    if (item.name === "Tenants") return false;

    if (item.requiresModule) {
      return settings?.modules?.[item.requiresModule] !== false;
    }
    return true;
  });

  const handleLogout = async () => {
    try {
      const token = user?.token;
      if (token) {
        await fetch(ENDPOINTS.AUTH_LOGOUT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      dispatch(logout());
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Toaster position="top-right" />
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900 bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`
            fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            lg:relative lg:translate-x-0
            border-r border-slate-800
            flex flex-col
        `}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800">
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="Go to dashboard home"
          >
            <img src="/merchpilot.png" alt="Logo" className="h-8 w-8" />
            <span className="text-xl font-bold text-white">MerchPilot</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                                    flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors
                                    ${isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }
                                `}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto w-full p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-slate-400 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-slate-900 shadow-sm h-16 flex items-center justify-between px-6 lg:px-8 border-b border-slate-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center ml-auto">
            <span className="text-sm text-slate-300 mr-4">
              Welcome,{" "}
              <span className="font-semibold text-white">{user?.name}</span>
            </span>
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold ring-2 ring-slate-800">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
