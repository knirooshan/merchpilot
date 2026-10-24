import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Save, Server, Globe } from "lucide-react";
import { ENDPOINTS } from "../config/api";

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    smtp: {
      host: "",
      port: 587,
      user: "",
      pass: "",
      secure: false,
      fromName: "",
      fromEmail: "",
    },
    general: {
      appName: "",
      supportEmail: "",
    },
  });

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(ENDPOINTS.ADMIN_SETTINGS, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // ... rest of function
      // Merge with defaults to avoid null issues
      setFormData({
        smtp: {
          host: data.smtp?.host || "",
          port: data.smtp?.port || 587,
          user: data.smtp?.user || "",
          pass: data.smtp?.pass || "",
          secure: data.smtp?.secure || false,
          fromName: data.smtp?.fromName || "",
          fromEmail: data.smtp?.fromEmail || "",
        },
        general: {
          appName: data.general?.appName || "",
          supportEmail: data.general?.supportEmail || "",
        },
      });
    } catch (error) {
      console.error("Failed to load settings", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(ENDPOINTS.ADMIN_SETTINGS, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-white p-8">Loading settings...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Server className="h-8 w-8 text-blue-500" />
          System Settings
        </h1>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
          <Globe className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">General Settings</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Application Name
            </label>
            <input
              type="text"
              value={formData.general.appName}
              onChange={(e) =>
                handleChange("general", "appName", e.target.value)
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Support Email
            </label>
            <input
              type="email"
              value={formData.general.supportEmail}
              onChange={(e) =>
                handleChange("general", "supportEmail", e.target.value)
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
          <Server className="h-5 w-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">
            SMTP Configuration (System Emails)
          </h2>
        </div>
        <p className="text-sm text-slate-400 -mt-4">
          These settings are used for system-wide notifications, such as new
          tenant welcome emails.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              SMTP Host
            </label>
            <input
              type="text"
              value={formData.smtp.host}
              onChange={(e) => handleChange("smtp", "host", e.target.value)}
              placeholder="smtp.example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              SMTP Port
            </label>
            <input
              type="number"
              value={formData.smtp.port}
              onChange={(e) =>
                handleChange("smtp", "port", parseInt(e.target.value))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              SMTP Username
            </label>
            <input
              type="text"
              value={formData.smtp.user}
              onChange={(e) => handleChange("smtp", "user", e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              SMTP Password
            </label>
            <input
              type="password"
              value={formData.smtp.pass}
              onChange={(e) => handleChange("smtp", "pass", e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              From Name
            </label>
            <input
              type="text"
              value={formData.smtp.fromName}
              onChange={(e) => handleChange("smtp", "fromName", e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center pt-8">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.smtp.secure}
                onChange={(e) =>
                  handleChange("smtp", "secure", e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-400">
                Secure (SSL/TLS)
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
