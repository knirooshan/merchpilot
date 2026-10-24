import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ENDPOINTS } from "./config/api";
import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "./store/slices/authSlice";
import apiClient from "./api/apiClient";
import { Toaster } from "react-hot-toast";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/Layout";
import Tenants from "./pages/Tenants";
import AdminSettings from "./pages/AdminSettings";
import SetupPage from "./pages/SetupPage";
import FirstTimeSetup from "./pages/FirstTimeSetup"; // Kept for backward compatibility or special cases
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import Quotations from "./pages/Quotations";
import CreateQuotation from "./pages/CreateQuotation";
import EditQuotation from "./pages/EditQuotation";
import QuotationView from "./pages/QuotationView";
import Invoices from "./pages/Invoices";
import CreateInvoice from "./pages/CreateInvoice";
import EditInvoice from "./pages/EditInvoice";
import InvoiceView from "./pages/InvoiceView";
import POS from "./pages/POS";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Vendors from "./pages/Vendors";
import ActivityLog from "./pages/ActivityLog";
import Payments from "./pages/Payments";
import Users from "./pages/Users";
import MediaLibrary from "./pages/MediaLibrary";
import DeliveryTracking from "./pages/DeliveryTracking";
import OutstandingInvoices from "./pages/OutstandingInvoices";

function App() {
  const [isFirstRun, setIsFirstRun] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useSelector((state) => state.auth);
  const isSuperAdmin = useSelector((state) => state.auth.user?.isSuperAdmin);
  const { data: settings } = useSelector((state) => state.settings);
  const dispatch = useDispatch();

  useEffect(() => {
    const checkState = async () => {
      try {
        const { data } = await apiClient.get(ENDPOINTS.FIRST_RUN_CHECK);
        setIsFirstRun(data.isFirstRun);

        if (data.isFirstRun) {
          dispatch(logout());
        }

        // Verify token if authenticated
        if (isAuthenticated) {
          await apiClient.get(ENDPOINTS.AUTH_VERIFY);
        }
      } catch (error) {
        if (error.response?.status !== 403) {
          console.error("Failed to check status:", error);
          setIsFirstRun(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkState();

    const handleSetupRequired = () => setSetupRequired(true);
    window.addEventListener("merchpilot:setup_required", handleSetupRequired);

    return () => {
      window.removeEventListener("merchpilot:setup_required", handleSetupRequired);
    };
  }, [dispatch, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        {/* Setup Route - Highest Priority */}
        {setupRequired && (
          <>
            <Route path="/setup" element={<SetupPage />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </>
        )}

        {/* First-time setup (Legacy/Single Tenant) */}
        {!setupRequired && isFirstRun && !isAuthenticated && (
          <>
            <Route path="/first-time-setup" element={<FirstTimeSetup />} />
            <Route
              path="*"
              element={<Navigate to="/first-time-setup" replace />}
            />
          </>
        )}

        {/* Login route */}
        {!setupRequired && !isFirstRun && !isAuthenticated && (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}

        {/* Protected routes */}
        {!setupRequired && isAuthenticated && (
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              {/* Super Admin Redirect */}
              <Route
                path="/"
                element={
                  isSuperAdmin ? (
                    <Navigate to="/tenants" replace />
                  ) : (
                    <Dashboard />
                  )
                }
              />

              {settings?.modules?.pos !== false && (
                <Route path="/pos" element={<POS />} />
              )}
              <Route path="/products" element={<Products />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/quotations" element={<Quotations />} />
              <Route path="/quotations/create" element={<CreateQuotation />} />
              <Route path="/quotations/edit/:id" element={<EditQuotation />} />
              <Route path="/quotations/:id" element={<QuotationView />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/create" element={<CreateInvoice />} />
              <Route path="/invoices/edit/:id" element={<EditInvoice />} />
              <Route path="/invoices/:id" element={<InvoiceView />} />
              <Route path="/deliveries" element={<DeliveryTracking />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/users" element={<Users />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/media-library" element={<MediaLibrary />} />
              <Route path="/activity-log" element={<ActivityLog />} />
              <Route
                path="/outstanding-invoices"
                element={<OutstandingInvoices />}
              />
              <Route path="/tenants" element={<Tenants />} />
              <Route
                path="/admin/settings"
                element={
                  isSuperAdmin ? <AdminSettings /> : <Navigate to="/" replace />
                }
              />
            </Route>
          </Route>
        )}
      </Routes>
    </Router>
  );
}

export default App;
